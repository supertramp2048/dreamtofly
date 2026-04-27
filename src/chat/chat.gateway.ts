import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UsePipes, ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { ChatService } from './chat.service'; // Bạn sẽ tạo service này sau
import { SendMessageDto } from './dto/send-message.dto';
import { ChatbotService } from 'src/chatbot/chatbot.service';

// Mở cổng CORS nếu frontend chạy khác port
@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly userSocketIds = new Map<string, Set<string>>();

    private conversationUpdatesRoom(userId: string) {
        return `conversation_updates:${userId}`;
    }

    private aiRoom(userId: string) {
        return `ai_room:${userId}`;
    }

    constructor(
        private readonly chatService: ChatService,
        private readonly chatBotService: ChatbotService
    ) { }

    // 1. BẮT SỰ KIỆN KHI CLIENT KẾT NỐI
    async handleConnection(client: Socket) {
        try {
            // Lấy token từ handshake (client gửi lên qua extraHeaders hoặc auth)
            const token = client.handshake.auth.token || client.handshake.headers['authorization'];

            if (!token) throw new UnauthorizedException('Thiếu token xác thực');

            // Giải mã token và lấy thông tin user (Tích hợp logic từ module Auth của bạn)
            // Giả sử sau khi verify, bạn có userId:
            const userId = await this.chatService.verifyUserToken(token);

            // Lưu userId vào object client để dùng cho các request sau
            client.data.userId = userId;

            const socketIds = this.userSocketIds.get(userId) ?? new Set<string>();
            socketIds.add(client.id);
            this.userSocketIds.set(userId, socketIds);

            // Lấy tất cả các phòng chat (conversationId) mà user này đang tham gia từ DB
            const userConversations = await this.chatService.getUserConversationIds(userId);
            // Ép socket của user này join vào tất cả các phòng đó
            if (userConversations.length > 0) {
                client.join(userConversations);
            }
            console.log(`User ${userId} connected with socket ${client.id}`);
        } catch (error) {
            console.log(`Connection rejected: ${error}`);
            client.disconnect(); // Ngắt kết nối ngay lập tức nếu không hợp lệ
        }
    }

    // 2. BẮT SỰ KIỆN KHI CLIENT NGẮT KẾT NỐI
    handleDisconnect(client: Socket) {
        console.log(`User ${client.data.userId} disconnected`);
        const userId = client.data.userId as string | undefined;
        if (userId) {
            const socketIds = this.userSocketIds.get(userId);
            if (socketIds) {
                socketIds.delete(client.id);
                if (socketIds.size === 0) {
                    this.userSocketIds.delete(userId);
                }
            }
        }
        // Socket.io tự động rời khỏi các rooms, không cần xử lý thủ công
    }

    // 3. XỬ LÝ LẮNG NGHE TIN NHẮN TỪ CLIENT
    @UsePipes(new ValidationPipe())
    @SubscribeMessage('send_message')
    async handleMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: SendMessageDto,
    ) {
        const senderId = String(client.data.userId);
        console.log('Đã nhận được payload:', payload);
        // Lưu tin nhắn vào Database thông qua ChatService
        const savedMessage = await this.chatService.saveMessage(
            senderId, payload);
        console.log(savedMessage);

        // 2. Xử lý Join Room đột xuất nếu là phòng mới
        if (savedMessage.isNewConversation) {
            // Ép người gửi (A) join vào phòng mới
            client.join(savedMessage.conversationId);
            if (savedMessage.receiverId) {
                console.log("join other");
                
                const receiverSocketIds = this.userSocketIds.get(savedMessage.receiverId);
                if (receiverSocketIds) {
                    console.log('join socket ');
                    
                    for (const socketId of receiverSocketIds) {
                        this.server.sockets.sockets.get(socketId)?.join(savedMessage.conversationId);
                    }
                }
            }
        }
        const lastMessageContent = savedMessage.message?.content
            ?? (savedMessage.message?.fileUrl ? '[file]' : null);

        const senderConversationPayload = await this.chatService.buildConversationPayloadForUser(
            savedMessage.conversationId,
            senderId,
            lastMessageContent,
        );
        this.server.to(this.conversationUpdatesRoom(senderId)).emit(
            'receive_conversation',
            senderConversationPayload,
        );

        const receiverId = senderConversationPayload.receiverId || savedMessage.receiverId;
        if (receiverId) {
            const receiverConversationPayload = await this.chatService.buildConversationPayloadForUser(
                savedMessage.conversationId,
                receiverId,
                lastMessageContent,
            );
            this.server.to(this.conversationUpdatesRoom(receiverId)).emit(
                'receive_conversation',
                receiverConversationPayload,
            );
        }
        // Phát tin nhắn đến TẤT CẢ mọi người trong phòng (bao gồm cả người gửi để cập nhật UI)
        this.server.to(savedMessage.conversationId).emit('receive_message', savedMessage.message);

        // Tính năng Push Notification (Gợi ý: Gọi logic đẩy vào Queue ở đây cho các user đang offline)
        // this.chatService.handleOfflineNotifications(payload.conversationId, senderId, savedMessage);
    }
    @UsePipes(new ValidationPipe())
    @SubscribeMessage('join_room')
    handleJoinRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { conversationId: string },
    ) {
        client.join(payload.conversationId);
        console.log(`Socket ${client.id} joined room ${payload.conversationId}`);
    }

    @SubscribeMessage('join_ai_room')
    handleJoinAiRoom(@ConnectedSocket() client: Socket) {
        const userId = client.data.userId as string | undefined;
        if (!userId) {
            throw new UnauthorizedException('Missing user in request');
        }
        client.join(this.aiRoom(userId));
        console.log(`Socket ${client.id} joined ai room ${userId}`);
    }

    @SubscribeMessage('join_all')
    handleJoinAll(@ConnectedSocket() client: Socket) {
        const userId = client.data.userId as string | undefined;
        if (!userId) {
            throw new UnauthorizedException('Missing user in request');
        }
        client.join(this.conversationUpdatesRoom(userId));
        console.log(`Socket ${client.id} joined conversation updates ${userId}`);
    }
    //  XỬ LÝ LẮNG NGHE TIN NHẮN TỪ CLIENT toi ai (STREAM qua Socket)
    @UsePipes(new ValidationPipe())
    @SubscribeMessage('send_message_to_chatbot')
    async handleAiMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: SendMessageDto,
    ) {
        const senderId = String(client.data.userId);
        console.log('send promt ', payload.content);

        // 1. Lưu tin nhắn của user vào DB và gửi lại cho chính user đó
        const savedMessage = await this.chatBotService.saveMessage(senderId, '1010', payload);
        const bearer = client.handshake.headers.authorization
        console.log("bearer token ",bearer);
        
        this.server.to(this.aiRoom(senderId)).emit('receive_chatbot_message', savedMessage.message);
        //console.log("promt ",);
        
        try {
            // 2. Gọi AI stream từ service
            const stream = await this.chatBotService.getAiStream(payload.content ?? '', senderId);

            if (!stream) {
                client.emit('chatbot_error', { message: 'Không thể kết nối với AI provider.' });
                return;
            }

            let fullReply = '';
            
            // TẠO MỘT ID TẠM THỜI CHO TIN NHẮN STREAM
            const aiMessageTempId = 'ai-msg-' + Date.now();

            // 3. Mỗi chunk data → emit ngay cho client
            stream.on('data', (chunk: Buffer) => {
                const text = chunk.toString('utf-8');
                fullReply += text;
                console.log('emit chunk');
                
                // ĐỔI TÊN EVENT VÀ CẤU TRÚC CHO KHỚP VỚI VUE FRONTEND
                client.emit('receive_ai_chunk', { 
                    id: aiMessageTempId, 
                    text: text 
                });
            });

            // 4. Khi stream kết thúc
            stream.on('end', async () => {
                if (fullReply.trim()) {
                    // Lưu full reply vào DB
                    const savedReplyMessage = await this.chatBotService.saveMessage(
                        '1010', senderId, { content: fullReply }
                    );
                    
                    // Báo cho Frontend biết là đã stream xong và gửi kèm ID thật từ DB
                    client.emit('receive_ai_end', { 
                        tempId: aiMessageTempId, 
                        finalId: savedReplyMessage.message.id 
                    });
                }
            });

            // 5. Xử lý lỗi stream
            stream.on('error', (err: any) => {
                if (err.code === 'ECONNRESET') {
                    console.warn('AI stream bị ngắt (ECONNRESET)');
                } else {
                    console.error('Lỗi stream AI:', err);
                }
                client.emit('chatbot_error', { message: 'Lỗi trong quá trình nhận phản hồi từ AI.' });
            });

        } catch (error) {
            console.error('Lỗi khi gọi AI stream:', error);
            client.emit('chatbot_error', { message: 'Lỗi máy chủ khi kết nối với AI.' });
        }
    }
}