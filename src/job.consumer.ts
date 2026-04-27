import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import { ChatGateway } from './chat/chat.gateway';
import { ChatbotService } from './chatbot/chatbot.service';

// Đắng ký lắng nghe queue tên là 'job-queue'
@Processor('job-queue')
export class JobConsumer extends WorkerHost {
    private readonly logger = new Logger(JobConsumer.name);
    private readonly emittedJobIds = new Set<string>();

    constructor(
        private readonly chatGateway: ChatGateway,
        private readonly chatBotService: ChatbotService,
        @InjectQueue('job-queue') private readonly jobQueue: Queue,
    ) {
        super();
    }

    private async emitQueuedLinksBeforeCrawl(): Promise<void> {
        const jobs = await this.jobQueue.getJobs([
            'waiting',
            'delayed',
            'prioritized',
            'active',
        ]);

        for (const queuedJob of jobs) {
            const jobId = String(queuedJob.id);
            if (this.emittedJobIds.has(jobId)) continue;

            const url = queuedJob.data?.url;
            if (!url) continue;

            const targetUserId = queuedJob.data?.userId
                ? String(queuedJob.data.userId)
                : null;

            if (targetUserId) {
                const savedMessage = await this.chatBotService.saveMessage(
                    '1010',
                    targetUserId,
                    { content: url },
                );

                this.chatGateway.server
                    .to(`ai_room:${targetUserId}`)
                    .emit('receive_chatbot_message', savedMessage.message);
            } else {
                this.logger.warn(`Thiếu userId trong job ${jobId}, chỉ emit broadcast`);
                this.chatGateway.server.emit('receive_chatbot_message', {
                    id: `job-link-${jobId}`,
                    content: url,
                    fileUrl: null,
                    createdAt: new Date(),
                    senderId: '1010',
                    receiverId: null,
                    sender: { id: '1010', name: 'AI' },
                });
            }

            this.emittedJobIds.add(jobId);
        }
    }

    // Hàm này TỰ ĐỘNG chạy khi có data mới trong Redis
    async process(job: Job<any, any, string>): Promise<any> {
        // job.data chính là cái object {"url": "https..."} mà Python 1 đã đẩy vào
        this.logger.log(`Nội dung đầy đủ của job.data: ${JSON.stringify(job.data)}`);
        const url = job.data.url;

        this.logger.log(`[+] Vừa nhặt được Link từ Redis: ${url}`);

        // Emit toàn bộ link trong Redis trước khi gọi API crawl
        try {
            await this.emitQueuedLinksBeforeCrawl();
        } catch (emitError) {
            this.logger.warn(`Không emit được danh sách link: ${emitError}`);
        }

        try {
            // goi api de ai lay job deal
            const response = await axios.post('http://localhost:8000/api/v1/crawl-detail', { url });

            const jobDetail = response.data;
            this.logger.log(`Đã tìm thấy Job Deal: ${JSON.stringify(jobDetail)}`);

            // Ở đây bạn lưu jobDetail vào Database (PostgreSQL/TypeORM)
            return jobDetail;
        } catch (error) {
            this.logger.error(`Lỗi khi xử lý link ${url}: ${error}`);
            throw error; // BullMQ sẽ tự động đưa vào danh sách failed và thử lại sau
        }
    }
}
