import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { SubscriptionService } from '@cupo/backend/services';
import { LocalAuthGuard } from '../provider/local-auth.guard';
import { LocalStrategy } from '../provider/local.strategy';
import { JwtAuthGuard } from '../provider/jwt-auth.guard';
import { JwtStrategy } from '../provider/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JWT_SECRET } from '@cupo/backend/constant';
import { EventModule } from '@cupo/event';

@Module({
  imports: [
    EventModule,
    PassportModule,
    JwtModule.register({
      secret: JWT_SECRET,
      // signOptions: { expiresIn: '60m' },
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, LocalStrategy, LocalAuthGuard, SubscriptionService],
  exports: [AuthService],
})
export class AuthModule {}
