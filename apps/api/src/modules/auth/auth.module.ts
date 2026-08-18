import { Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

const jwtModule = JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.get<string>('JWT_SECRET', 'change-me-in-production'),
    signOptions: {
      expiresIn: config.get<string>('JWT_EXPIRES_IN', '12h') as JwtSignOptions['expiresIn'],
    },
  }),
});

@Module({
  imports: [jwtModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionsGuard],
  exports: [jwtModule, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
