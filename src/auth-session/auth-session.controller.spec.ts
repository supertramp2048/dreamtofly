import { Test, TestingModule } from '@nestjs/testing';
import { AuthSessionController } from './auth-session.controller';
import { AuthSessionService } from './auth-session.service';

describe('AuthSessionController', () => {
  let controller: AuthSessionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthSessionController],
      providers: [AuthSessionService],
    }).compile();

    controller = module.get<AuthSessionController>(AuthSessionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
