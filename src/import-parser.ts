import {CommerceMlAbstractParser, CommerceMlCollectRule} from './abstract-parser';
import {
  Catalog,
  Classifier,
  ClassifierGroup,
  ClassifierProperty,
  CommercialInformation,
  Counterparty, DictionaryValue, Product,
  PropertyValue, RequisiteValue
} from './types';

export class CommerceMlImportParser extends CommerceMlAbstractParser {
  /**
   * Parses commercial information schemaVersion and creationTimestamp attributes.
   * @param callback
   */
  public onCommercialInformation(callback: (commercialInformation: CommercialInformation) => void): void {
    this.parser.on('commercialInformation', (data: any) => {
      const commercialInformation: CommercialInformation = {
        schemaVersion: data.КоммерческаяИнформация._ВерсияСхемы,
        creationTimestamp: new Date(data.КоммерческаяИнформация._ДатаФормирования)
      };

      callback(commercialInformation);
    });
  }

  /**
   * Parses classifier block header without details.
   * @param callback
   */
  public onClassifier(callback: (classifier: Classifier) => void): void {
    this.parser.on('classifier', (data: any) => {
      const classifierXml = data.Классификатор;
      const classifier: Classifier = {
        id: classifierXml.Ид,
        name: classifierXml.Наименование,
        owner: this.parseCounterpartyXmlData(classifierXml.Владелец)
      };

      callback(classifier);
    });
  }

  /**
   * Parses classifier groups.
   * @param callback
   */
  public onClassifierGroup(callback: (classifierGroup: ClassifierGroup) => void): void {
    const processGroup = (groupData: any): ClassifierGroup => {
      const result: ClassifierGroup = {
        id: groupData.Ид,
        name: groupData.Наименование
      };

      const children: ClassifierGroup[] = [];
      if (groupData.Группы?.Группа?.length > 0) {
        for (const child of groupData.Группы.Группа) {
          children.push(processGroup(child));
        }
      }

      if (children.length > 0) {
        result.groups = children;
      }

      return result;
    };

    this.parser.on('classifierGroup', (data: any) => {
      const classifierGroupXml = data.Группа;
      const classifierGroup: ClassifierGroup = processGroup(classifierGroupXml);
      callback(classifierGroup);
    });
  }

  /**
   * Parses classifier properties.
   * @param callback
   */
  public onClassifierProperty(callback: (classifierProperty: ClassifierProperty) => void): void {
    this.parser.on('classifierProperty', (data: any) => {
      const propertyXml = data.Свойство;

      const classifierProperty: ClassifierProperty = {
        id: propertyXml.Ид,
        name: propertyXml.Наименование,
        type: propertyXml.ТипЗначений
      };

      if (propertyXml.ВариантыЗначений?.Справочник?.length > 0) {
        classifierProperty.dictionaryValues = [];
        for (const dictionaryValue of propertyXml.ВариантыЗначений.Справочник) {
          classifierProperty.dictionaryValues.push({
            id: dictionaryValue.ИдЗначения,
            value: dictionaryValue.Значение
          } as DictionaryValue);
        }
      }

      callback(classifierProperty);
    });
  }

  /**
   * Parses catalog header without details.
   * @param callback
   */
  public onCatalog(callback: (catalog: Catalog) => void) {
    this.parser.on('catalog', (data: any) => {
      const catalogXml = data.Каталог;
      const catalog: Catalog = {
        id: catalogXml.Ид,
        classifierId: catalogXml.ИдКлассификатора,
        name: catalogXml.Наименование,
        owner: this.parseCounterpartyXmlData(catalogXml.Владелец),
        products: []
      };

      callback(catalog);
    });
  }

  /**
   * Parses catalog products.
   * @param callback
   */
  public onProduct(callback: (product: Product) => void) {
    this.parser.on('product', (data: any) => {
      const productXml = data.Товар;
      const product: Product = {
        id: productXml.Ид,
        article: productXml.Артикул,
        name: productXml.Наименование,
        baseMeasurementUnit: {
          code: productXml.БазоваяЕдиница._Код,
          fullName: productXml.БазоваяЕдиница._НаименованиеПолное,
          acronym: productXml.БазоваяЕдиница._МеждународноеСокращение
        },
        groupId: productXml.Группы.Ид,
        description: productXml.Описание
      };

      if (productXml.СтавкиНалогов?.СтавкаНалога) {
        if (Array.isArray(productXml.СтавкиНалогов?.СтавкаНалога)) {
          product.taxRates = [];
          for (const taxRateXml of productXml.СтавкиНалогов?.СтавкаНалога) {
            product.taxRates.push({
              name: taxRateXml.Наименование,
              rate: taxRateXml.Ставка
            });
          }
        } else {
          product.taxRates = [{
            name: productXml.СтавкиНалогов.СтавкаНалога.Наименование,
            rate: productXml.СтавкиНалогов.СтавкаНалога.Ставка
          }];
        }
      }

      if (productXml.Штрихкод) {
        product.barcode = productXml.Штрихкод;
      }

      if (productXml.Изготовитель) {
        product.manufacturer = {
          id: productXml.Изготовитель.Ид,
          name: productXml.Изготовитель.Наименование
        };
      }

      if (productXml.ЗначенияСвойств?.ЗначенияСвойства?.length > 0) {
        product.propertyValues = [];
        for (const propertyValue of productXml.ЗначенияСвойств.ЗначенияСвойства) {
          if (Array.isArray(propertyValue.Значение)) {
            product.propertyValues.push({
              id: propertyValue.Ид,
              values: propertyValue.Значение
            } as PropertyValue);
          } else {
            product.propertyValues.push({
              id: propertyValue.Ид,
              values: [propertyValue.Значение]
            } as PropertyValue);
          }
        }
      }

      if (productXml.ЗначенияРеквизитов?.ЗначениеРеквизита?.length > 0) {
        product.requisiteValues = [];
        for (const requisiteValue of productXml.ЗначенияРеквизитов.ЗначениеРеквизита ?? []) {
          if (Array.isArray(requisiteValue.Значение)) {
            product.requisiteValues.push({
              name: requisiteValue.Наименование,
              values: requisiteValue.Значение
            } as RequisiteValue);
          } else {
            product.requisiteValues.push({
              name: requisiteValue.Наименование,
              values: [requisiteValue.Значение]
            } as RequisiteValue);
          }
        }
      }

      callback(product);
    });
  }

  /**
   * Helper method to parse counterparty XML data.
   * @param xmlData
   */
  protected parseCounterpartyXmlData(xmlData: any): Counterparty {
    const counterparty: Counterparty = {
      id: xmlData.Ид,
      name: xmlData.Наименование
    };

    // Detect company info or person info
    if (xmlData.ОфициальноеНаименование) {
      counterparty.companyInfo = {
        officialName: xmlData.ОфициальноеНаименование,
        inn: xmlData.ИНН,
        kpp: xmlData.КПП,
        okpo: xmlData.ОКПО
      };
    } else {
      counterparty.personInfo = {
        fullName: xmlData.ПолноеНаименование
      };
    }

    return counterparty;
  }

  /**
   * Parser rules.
   */
  protected getCollectRules(): {[key: string]: CommerceMlCollectRule} {
    return {
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
      classifierGroup: {
        start: ['КоммерческаяИнформация', 'Классификатор', 'Группы', 'Группа'],
        include: [
          ['КоммерческаяИнформация', 'Классификатор', 'Группы', 'Группа']
        ]
      },
      classifierProperty: {
        start: ['КоммерческаяИнформация', 'Классификатор', 'Свойства', 'Свойство'],
        include: [
          ['КоммерческаяИнформация', 'Классификатор', 'Свойства', 'Свойство']
        ]
      },
      catalog: {
        start: ['КоммерческаяИнформация', 'Каталог'],
        include: [
          ['КоммерческаяИнформация', 'Каталог', 'Ид'],
          ['КоммерческаяИнформация', 'Каталог', 'ИдКлассификатора'],
          ['КоммерческаяИнформация', 'Каталог', 'Наименование'],
          ['КоммерческаяИнформация', 'Каталог', 'Владелец']
        ]
      },
      product: {
        start: ['КоммерческаяИнформация', 'Каталог', 'Товары', 'Товар'],
        include: [
          ['КоммерческаяИнформация', 'Каталог', 'Товары', 'Товар']
        ]
      }
    };
  }
}
