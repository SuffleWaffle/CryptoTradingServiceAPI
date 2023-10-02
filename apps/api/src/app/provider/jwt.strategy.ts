import { Dependencies, Injectable, UnauthorizedException } from '@nestjs/common';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JWT_SECRET } from '@cupo/backend/constant';
import { JwtToken } from '@cupo/backend/interface';

@Injectable()
@Dependencies(AuthService, JwtAuthGuard)
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  async validate(jwt_payload: JwtToken) {
    const user = await this.authService.validateJwtStrategyUser(jwt_payload);
    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
