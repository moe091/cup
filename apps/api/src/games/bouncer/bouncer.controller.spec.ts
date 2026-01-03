import { Test, TestingModule } from '@nestjs/testing';
import { BouncerController } from './bouncer.controller';

describe('BouncerController', () => {
  let controller: BouncerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BouncerController],
    }).compile();

    controller = module.get<BouncerController>(BouncerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
