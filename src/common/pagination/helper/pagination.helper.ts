import { SelectQueryBuilder } from "typeorm";
import { PageOptionsDto } from "../dto/pageOption.dto";
import { PageMetaDto } from "../dto/pageMeta.dto";
import { PageDto } from "../dto/page.dto";
import { ObjectLiteral } from "typeorm";
import { Order } from "../enum/order.enum";
import { OrderBy } from "../enum/orderBy.enum";
export async function paginate<T extends ObjectLiteral>(
    querybuilder: SelectQueryBuilder<T>,
    pageOptionsDto: PageOptionsDto,
    table: string
) {
    const orderBy = pageOptionsDto.orderBy ?? OrderBy.CREATEAT;
    const order = pageOptionsDto.order ?? Order.ASC;
    const hasOrder = Object.keys(querybuilder.expressionMap.orderBys).length > 0;

    if (!hasOrder) {
        querybuilder.orderBy(`${table}.${orderBy}`, order);
    }
    if (!querybuilder.expressionMap.orderBys[`${table}.id`]) {
        // Secondary sort stabilizes results when timestamps tie.
        querybuilder.addOrderBy(`${table}.id`, order);
    }

    querybuilder
        .skip(pageOptionsDto.skip)
        .take(pageOptionsDto.take)

        const itemCount = await querybuilder.getCount()
        const {entities} = await querybuilder.getRawAndEntities()

        const pageMetaDto = new PageMetaDto({itemCount, pageOptionsDto})
        return new PageDto(entities,pageMetaDto)
}