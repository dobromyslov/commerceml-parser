import {CommerceMlAbstractParser} from './abstract-parser';
import {
  Classifier,
  CommercialInformation,
  Offer,
  OffersPackage,
  PriceType,
  Warehouse
} from 'commerceml-parser-core';
import {convertToArray, parseCounterpartyXmlData} from './utils';

export class CommerceMlOffersParser extends CommerceMlAbstractParser {
  /**
   * Parser Rules.
   */
  protected rules = {
    commercialInformation: {
      start: ['КоммерческаяИнформация']
    },
    classifier: {
      start: ['КоммерческаяИнформация', 'Классификатор'],
      include: [
        ['КоммерческаяИнформация', 'Классификатор', 'Ид'],
        ['КоммерческаяИнформация', 'Классификатор', 'Наименование'],
        ['КоммерческаяИнформация', 'Классификатор', 'Владелец']
      ]
    },
    classifierProperty: {
      start: ['КоммерческаяИнформация', 'Классификатор', 'Свойства', 'Свойство'],
      include: [
        ['КоммерческаяИнформация', 'Классификатор', 'Свойства', 'Свойство']
      ]
    },
    offersPackage: {
      start: ['КоммерческаяИнформация', 'ПакетПредложений'],
      include: [
        ['КоммерческаяИнформация', 'ПакетПредложений', 'Ид'],
        ['КоммерческаяИнформация', 'ПакетПредложений', 'Наименование'],
        ['КоммерческаяИнформация', 'ПакетПредложений', 'ИдКаталога'],
        ['КоммерческаяИнформация', 'ПакетПредложений', 'ИдКлассификатора'],
        ['КоммерческаяИнформация', 'ПакетПредложений', 'Владелец'],
        ['КоммерческаяИнформация', 'ПакетПредложений', 'ТипыЦен']
      ]
    },
    warehouse: {
      start: ['КоммерческаяИнформация', 'ПакетПредложений', 'Склады', 'Склад'],
      include: [
        ['КоммерческаяИнформация', 'ПакетПредложений', 'Склады', 'Склад']
      ]
    },
    offer: {
      start: ['КоммерческаяИнформация', 'ПакетПредложений', 'Предложения', 'Предложение'],
      include: [
        ['КоммерческаяИнформация', 'ПакетПредложений', 'Предложения', 'Предложение']
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
   * Parses classifier block header without details.
   * @param callback
   */
  public onClassifier(callback: (classifier: Classifier) => void | Promise<void>): void {
    this.eventEmitter.on('classifier', async (data: any) => {
      const classifierXml = data.Классификатор;
      const classifier: Classifier = {
        id: classifierXml.Ид,
        name: classifierXml.Наименование,
        owner: parseCounterpartyXmlData(classifierXml.Владелец)
      };

      await callback(classifier);
    });
  }

  public onOffersPackage(callback: (offersPackage: OffersPackage) => void | Promise<void>): void {
    this.eventEmitter.on('offersPackage', async (data: any) => {
      const offersPackageXml = data.ПакетПредложений;
      const offersPackage: OffersPackage = {
        changesOnly: offersPackageXml._СодержитТолькоИзменения,
        id: offersPackageXml.Ид,
        name: offersPackageXml.Наименование,
        catalogId: offersPackageXml.ИдКаталога,
        classifierId: offersPackageXml.ИдКлассификатора,
        owner: parseCounterpartyXmlData(offersPackageXml.Владелец),
        offers: [],
        priceTypes: []
      };

      for (const priceTypeXml of convertToArray(offersPackageXml.ТипыЦен?.ТипЦены)) {
        const priceType: PriceType = {
          id: priceTypeXml.Ид,
          name: priceTypeXml.Наименование,
          currency: priceTypeXml.Валюта
        };

        if (priceTypeXml.Налог) {
          priceType.tax = {
            name: priceTypeXml.Налог.Наименование,
            includedInSum: priceTypeXml.Налог.УчтеноВСумме,
            excise: priceTypeXml.Налог.Акциз
          };
        }

        offersPackage.priceTypes.push(priceType);
      }

      await callback(offersPackage);
    });
  }

  public onWarehouse(callback: (warehouse: Warehouse) => void | Promise<void>): void {
    this.eventEmitter.on('warehouse', async (data: any) => {
      const warehouseXml = data.Склад;
      const warehouse: Warehouse = {
        id: warehouseXml.Ид,
        name: warehouseXml.Наименование
      };

      await callback(warehouse);
    });
  }

  public onOffer(callback: (offer: Offer) => void | Promise<void>): void {
    this.eventEmitter.on('offer', async (data: any) => {
      const offerXml = data.Предложение;
      const offer: Offer = {
        id: offerXml.Ид,
        name: offerXml.Наименование,
        baseMeasurementUnit: {
          code: offerXml.БазоваяЕдиница._Код,
          fullName: offerXml.БазоваяЕдиница._НаименованиеПолное,
          acronym: offerXml.БазоваяЕдиница._МеждународноеСокращение
        },
        quantity: offerXml.Количество
      };

      if (offerXml.Артикул) {
        offer.article = offerXml.Артикул;
      }

      offer.prices = [];
      for (const priceXml of convertToArray(offerXml.Цены?.Цена)) {
        offer.prices.push({
          representation: priceXml.Представление,
          priceTypeId: priceXml.ИдТипаЦены,
          pricePerUnit: priceXml.ЦенаЗаЕдиницу,
          currency: priceXml.Валюта,
          unitAcronym: priceXml.Единица,
          coefficient: priceXml.Коэффициент
        });
      }

      offer.stocks = [];
      for (const stockXml of convertToArray(offerXml.Склад)) {
        offer.stocks.push({
          warehouseId: stockXml._ИдСклада,
          quantity: Number.parseInt(stockXml._КоличествоНаСкладе, 10)
        });
      }

      await callback(offer);
    });
  }
}
