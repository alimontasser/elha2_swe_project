import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExpiryModule } from '../expiry/expiry.module';
import { ProductReviewController } from './product-review.controller';

/** Administration (SDD §3.1.3). Organisation verification (US-13.01) joins here when it moves off the demo. */
@Module({
  imports: [AuthModule, ExpiryModule],
  controllers: [ProductReviewController],
})
export class AdministrationModule {}
