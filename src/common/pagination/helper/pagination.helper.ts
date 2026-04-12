import { SelectQueryBuilder } from "typeorm";
import { PageOptionsDto } from "../dto/pageOption.dto";
import { PageMetaDto } from "../dto/pageMeta.dto";
import { PageDto } from "../dto/page.dto";
import { ObjectLiteral } from "typeorm";
export async function paginate<T extends ObjectLiteral>(
    querybuilder: SelectQueryBuilder<T>,
    pageOptionsDto: PageOptionsDto,
    table: string
) {
    querybuilder
        .orderBy(`${table}.${pageOptionsDto.orderBy}`)
        .skip(pageOptionsDto.skip)
        .take(pageOptionsDto.take)

        const itemCount = await querybuilder.getCount()
        const {entities} = await querybuilder.getRawAndEntities()

        const pageMetaDto = new PageMetaDto({itemCount, pageOptionsDto})
        return new PageDto(entities,pageMetaDto)
}