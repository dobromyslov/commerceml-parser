import {CommerceMlAbstractParser} from './abstract-parser';
import {CommercialInformation, Document} from 'commerceml-parser-core';

export class OrdersParser extends CommerceMlAbstractParser {
  /**
   * Parser rules.
   */
  protected rules ={
    commercialInformation: {
      start: ['КоммерческаяИнформация']
    },
    document: {
      start: ['КоммерческаяИнформация', 'Документ'],
      include: [
        ['КоммерческаяИнформация', 'Документ']
      ]
    }
  };

  /**
   * Parses commercial information schemaVersion and creationTimestamp attributes.
   * @param callback
   */
  public onCommercialInformation(callback: (commercialInformation: CommercialInformation) => void | Promise<void>): void {
    this.eventEmitter.on('commercialInformation', async (data: any) => {
      const commercialInformation: CommercialInformation = {
        schemaVersion: data.КоммерческаяИнформация._ВерсияСхемы,
        creationTimestamp: new Date(data.КоммерческаяИнформация._ДатаФормирования)
      };

      await callback(commercialInformation);
    });
  }

  /**
   * Parses document block.
   * @param callback
   */
  public onDocument(callback: (document: Document) => void | Promise<void>): void {
    this.eventEmitter.on('document', async (data: any) => {
      const documentXml = data.Документ;
      const document: Document = {
        id: documentXml.Ид,
        number: documentXml.Номер,
        date: documentXml.Дата,
        operation: documentXml.ХозОперация,
        role: documentXml.Роль,
        currency: documentXml.Валюта,
        // eslint-disable-next-line no-warning-comments
        counterparties: [] // TODO: нужен пример выгрузки
      };

      await callback(document);
    });
  }
}
