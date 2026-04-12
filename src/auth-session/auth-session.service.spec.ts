import { Test, TestingModule } from '@nestjs/testing';
import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService', () => {
  let service: AuthSessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthSessionService],
    }).compile();

    service = module.get<AuthSessionService>(AuthSessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
