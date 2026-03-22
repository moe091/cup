import { Controller, Get, Query, Req } from '@nestjs/common';
import type { EmojiCatalogResponseDto } from '@cup/shared-types';
import type { AuthedRequest } from 'src/auth/auth.types';
import { EmojisService } from './emojis.service';

@Controller('emojis')
export class EmojisController {
  constructor(private readonly emojisService: EmojisService) {}

  @Get('catalog')
  getCatalog(
    @Req() req: AuthedRequest,
    @Query('communityId') communityId: string | undefined,
  ): Promise<EmojiCatalogResponseDto> {
    return this.emojisService.getCatalog(req.user?.id, communityId);
  }

  @Get('resolve')
  resolveByIds(@Query('ids') ids: string | undefined): Promise<EmojiCatalogResponseDto> {
    return this.emojisService.resolveByIds(ids);
  }
}
