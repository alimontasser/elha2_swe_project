import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { AssistantController } from './assistant.controller';

/** Recipes (E4). Sprint 1 starts with the cooking assistant; suggestions and cooking follow in Sprint 2. */
@Module({
  imports: [AuthModule, AiModule],
  controllers: [AssistantController],
})
export class RecipesModule {}
