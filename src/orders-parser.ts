import {CommerceMlAbstractParser, CommerceMlCollectRule} from './abstract-parser';

export class OrdersParser extends CommerceMlAbstractParser {
  protected getCollectRules(): {[key: string]: CommerceMlCollectRule} {
    return {
      commercialInfo: {
        start: ['КоммерческаяИнформация']
      },
      document: {
        start: ['КоммерческаяИнформация', 'Документ'],
        include: [
          ['КоммерческаяИнформация', 'Документ']
        ]
      }
    };
  }
}
