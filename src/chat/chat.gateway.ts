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

// Mở cổng CORS nếu frontend chạy khác port
@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    constructor(private readonly chatService: ChatService) { }

    // 1. BẮT SỰ KIỆN KHI CLIENT KẾT NỐI
    async handleConnection(client: Socket) {
        try {
            // Lấy token từ handshake (client gửi lên qua extraHeaders hoặc auth)
            const token = client.handshake.auth.token || client.handshake.headers['authorization'];

            if (!token) throw new UnauthorizedException('Thiếu token xác thực');

            // Giải mã token và lấy thông tin user (Tích hợp logic từ module Auth của bạn)
            // Giả sử sau khi verify, bạn có userId:
            const userId = await this.chatService.verifyUserToken(token);
            console.log("id ",userId);
            
            // Lưu userId vào object client để dùng cho các request sau
            client.data.userId = userId;

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
        // Socket.io tự động rời khỏi các rooms, không cần xử lý thủ công
    }

    // 3. XỬ LÝ LẮNG NGHE TIN NHẮN TỪ CLIENT
    @UsePipes(new ValidationPipe())
    @SubscribeMessage('send_message')
    async handleMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: SendMessageDto,
    ) {
        const senderId = client.data.userId;
        console.log('Đã nhận được payload:', payload);
        // Lưu tin nhắn vào Database thông qua ChatService
        const savedMessage = await this.chatService.saveMessage(
            senderId, payload);
            console.log(savedMessage);
            
        // 2. Xử lý Join Room đột xuất nếu là phòng mới
        if (savedMessage.isNewConversation) {
            // Ép người gửi (A) join vào phòng mới
            client.join(savedMessage.conversationId);

            // Bắn một sự kiện ĐẶC BIỆT cho người nhận (B) dựa vào room mang tên userId của họ
            // Báo cho máy của B biết: "Có phòng chat mới nè, cậu chủ động join bằng code frontend đi"
            this.server.to(savedMessage.receiverId).emit('new_conversation_created', {
                conversationId: savedMessage.conversationId,
                message: savedMessage.message // Đính kèm luôn tin nhắn đầu tiên để UI hiện luôn
            });
        }
        // Phát tin nhắn đến TẤT CẢ mọi người trong phòng (bao gồm cả người gửi để cập nhật UI)
        this.server.to(payload.conversationId).emit('receive_message', savedMessage);

        // Tính năng Push Notification (Gợi ý: Gọi logic đẩy vào Queue ở đây cho các user đang offline)
        // this.chatService.handleOfflineNotifications(payload.conversationId, senderId, savedMessage);
    }
}