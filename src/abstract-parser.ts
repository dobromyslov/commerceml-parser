import {encodeXML} from 'entities/lib';
import X2JS from 'x2js';
import {CommonOptions, SaxesParser, SaxesTag} from 'saxes';
import Emittery from 'emittery';
import {Readable} from 'stream';

export interface CommerceMlRule {
  start: string[];
  include?: string[][];
}

export interface CommerceMlRules extends Record<string, CommerceMlRule> {}

/**
 * Saxes event which is buffered and returned by low level parseChunk() generator.
 */
export interface SaxesEvent {
  type: 'opentag' | 'text' | 'closetag' | 'end';
  tag?: SaxesTag;
  text?: string;
}

/**
 * CommerceML event which is buffered and returned by top level parse() generator.
 */
export interface ParserEvent {
  type: string;
  data?: unknown;
}

export abstract class CommerceMlAbstractParser {
  /**
   * Current position in the xml file.
   * Array of tag names.
   */
  protected xPath: string[] = [];

  /**
   * Current open tag name.
   * Last tag name in xPath array.
   */
  protected openTag = '';

  /**
   * Current parser rule key which is processed.
   */
  protected currentRuleKey = '';

  /**
   * XML content collected starting from the openTag (inclusive) till the close tag (inclusive).
   */
  protected xml = '';

  /**
   * Indicates whether current XML node should be collected according to parser rules.
   */
  protected collectCurrentNode = false;

  /**
   * List of currently opened tags.
   * i.e. xpath.
   */
  protected openTags: string[] = [];

  /**
   * Buffer of parser events collected from one parsed chunk.
   * @protected
   */
  protected events: ParserEvent[] = [];

  /**
   * Serial synchronous Event emitter.
   * @protected
   */
  protected eventEmitter: Emittery = new Emittery();

  /**
   * XML to plain JS objects convertor.
   * @protected
   */
  protected x2js = new X2JS();

  /**
   * CommerceML rules defines which XML tags should be collected and returned.
   * @protected
   */
  protected abstract rules: CommerceMlRules;

  public async parse(readable: Readable): Promise<void> {
    // https://nodejs.org/api/stream.html
    // chunk of data is a string if a default encoding has been specified
    // for the stream using the readable.setEncoding() method;
    // otherwise the data will be passed as a Buffer.
    readable.setEncoding('utf8');
    return this.parseIterable(readable as unknown as Iterable<string>);
  }

  public async parseIterable(iterable: Iterable<string>): Promise<void> {
    for await (const saxesEvents of this.parseChunk(iterable) ?? []) {
      for (const saxesEvent of saxesEvents ?? []) {
        switch (saxesEvent.type) {
          case 'opentag':
            this.onOpenTag(saxesEvent.tag!);
            break;

          case 'text':
            this.onText(saxesEvent.text!);
            break;

          case 'closetag':
            this.onCloseTag(saxesEvent.tag!);
            break;

          case 'end':
            this.events.push({type: 'end'});
            break;

          default:
            this.events.push({type: saxesEvent.type, data: saxesEvent.tag ?? saxesEvent.text});
        }
      }

      await this.processParserEvents(this.events);
      this.events = [];
    }
  }

  public onEnd(
    callback: () => void | Promise<void>
  ): void {
    this.eventEmitter.on('end', callback);
  }

  /**
   * Generator method.
   * Parses one chunk of the iterable input (Readable stream in the string data reading mode).
   * @see https://nodejs.org/api/stream.html#stream_event_data
   * @param iterable Iterable or Readable stream in the string data reading mode.
   * @returns Array of SaxesParser events
   * @throws Error if a SaxesParser error event was emitted.
   */
  public async * parseChunk(iterable: Iterable<string>): AsyncGenerator<SaxesEvent[], void, undefined> {
    const saxesParser = new SaxesParser<CommonOptions>();
    let error: Error | undefined;
    saxesParser.on('error', _error => {
      error = _error;
    });

    // As a performance optimization, we gather all events instead of passing
    // them one by one, which would cause each event to go through the event queue
    let events: SaxesEvent[] = [];
    saxesParser.on('opentag', tag => {
      events.push({
        type: 'opentag',
        tag
      });
    });

    saxesParser.on('text', text => {
      events.push({
        type: 'text',
        text
      });
    });

    saxesParser.on('closetag', tag => {
      events.push({
        type: 'closetag',
        tag
      });
    });

    for await (const chunk of iterable) {
      saxesParser.write(chunk);
      if (error) {
        throw error;
      }

      yield events;
      events = [];
    }

    yield [{
      type: 'end'
    }];
  }

  /**
   * Processes parser events.
   * @param events Collected parser events during one XML chunk parsing.
   * @protected
   */
  protected async processParserEvents(events: ParserEvent[]): Promise<void> {
    // Serial events emission
    for (const event of events ?? []) {
      // eslint-disable-next-line no-await-in-loop
      await this.eventEmitter.emitSerial(event.type, event.data);
    }
  }

  /**
   * SAX 'opentag' event handler.
   * @param tag
   */
  protected onOpenTag(tag: SaxesTag): void {
    this.openTag = tag.name;
    this.xPath.push(tag.name);
    this.collectCurrentNode = false;

    for (const [key, rule] of Object.entries(this.rules)) {
      // Check new rule start path
      if (this.isCurrentXPathEqualsToRuleXPath(rule.start)) {
        // If currentRule key already set then finish previous XML collection
        if (this.currentRuleKey) {
          this.addEventToBuffer();
        }

        // Start new XML collection
        this.currentRuleKey = key;
      }
    }

    if (this.currentRuleKey && this.shallCollect()) {
      this.collectCurrentNode = true;
      this.xml += `<${tag.name}`;
      this.openTags.push(tag.name);

      for (const [key, value] of Object.entries(tag.attributes)) {
        this.xml += ` ${key}="${value as string}"`;
      }
    }

    this.xml += '>';
  }

  /**
   *
   */
  protected shallCollect(): boolean {
    for (const rule of Object.values(this.rules)) {
      if (this.isCurrentXPathEqualsToRuleXPath(rule.start)) {
        return true;
      }

      for (const ruleInclude of rule.include ?? []) {
        if (this.isCurrentXPathStartsWithRuleXPath(ruleInclude)) {
          return true;
        }
      }
    }

    return false;
  }

  protected addEventToBuffer(): void {
    // Close all opened tags
    if (this.openTags.length > 0) {
      for (const tagName of this.openTags.reverse()) {
        this.xml += `</${tagName}>`;
      }

      this.openTags = [];
    }

    // Add parser event to the buffer
    this.events.push({
      type: this.currentRuleKey,
      data: this.x2js.xml2js(this.xml)
    });

    this.currentRuleKey = '';
    this.xml = '';
  }

  protected onText(text: string) {
    if (this.openTag && this.collectCurrentNode) {
      this.xml += encodeXML(text);
    }
  }

  protected onCloseTag(tag: SaxesTag): void {
    if (this.currentRuleKey) {
      if (this.shallCollect()) {
        this.xml += `</${tag.name}>`;
        this.openTags.pop();
      }

      if (this.isCurrentXPathEqualsToRuleXPath(this.rules[this.currentRuleKey].start)) {
        this.addEventToBuffer();
      }
    }

    this.collectCurrentNode = false;
    this.openTag = '';
    this.xPath.pop();
  }

  protected isCurrentXPathEqualsToRuleXPath(xPath: string[]): boolean {
    return this.xPath.length === xPath.length && this.xPath.join('/') === xPath.join('/');
  }

  protected isCurrentXPathStartsWithRuleXPath(xPath: string[]): boolean {
    return this.xPath.length >= xPath.length && this.xPath.join('/').startsWith(xPath.join('/'));
  }
}
