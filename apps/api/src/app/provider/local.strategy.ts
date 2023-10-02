import { Dependencies, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

import { AuthService } from '../auth/auth.service';
import { LocalAuthGuard } from './local-auth.guard';

@Injectable()
@Dependencies(AuthService, LocalAuthGuard)
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: false,
    });
  }

  async validate(email: string, password: string) {
    const user = await this.authService.validateLocalStrategyUser(email, password);
    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
