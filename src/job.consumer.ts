import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import axios from 'axios';

// Đắng ký lắng nghe queue tên là 'job-queue'
@Processor('job-queue')
export class JobConsumer extends WorkerHost {
    private readonly logger = new Logger(JobConsumer.name);

    // Hàm này TỰ ĐỘNG chạy khi có data mới trong Redis
    async process(job: Job<any, any, string>): Promise<any> {
        // job.data chính là cái object {"url": "https..."} mà Python 1 đã đẩy vào
        this.logger.log(`Nội dung đầy đủ của job.data: ${JSON.stringify(job.data)}`);
        const url = job.data.url;

        this.logger.log(`[+] Vừa nhặt được Link từ Redis: ${url}`);

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
