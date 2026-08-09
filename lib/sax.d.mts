import { XmlDisposable } from './disposable.mjs';
import type { ParseOptions } from './document.mjs';
import type { ErrorDetail, XmlSaxHandler } from './libxml2.mjs';
/**
 * A streaming (push) XML parser.
 *
 * `XmlSaxParser` wraps libxml2's push parser with SAX2 callbacks:
 * the document is fed incrementally, as raw bytes, with {@link push},
 * and its content is reported through the {@link XmlSaxHandler} callbacks
 * as soon as it has been parsed, without building an {@link XmlDocument}.
 * Memory usage therefore does not grow proportionally with the document size.
 *
 * The input may be split into chunks at arbitrary byte positions.
 * The encoding of the document is detected automatically,
 * from its BOM or XML declaration;
 * the callbacks always receive UTF-8 data.
 *
 * Entity references - predefined (`&amp;` …), character references
 * (`&#xA9;` …) and entities declared in the internal DTD subset -
 * are substituted in element content, and their replacement text is
 * reported through the regular callbacks:
 * {@link XmlSaxHandler#characters} for character data,
 * and the element callbacks for any markup it contains.
 * In attribute values, references to DTD-declared entities are passed
 * through literally unless {@link ParseOption.XML_PARSE_NOENT} is set -
 * see {@link XmlSaxAttribute#value}.
 *
 * Like other objects owning libxml2 memory, the parser must be released with
 * {@link dispose}, or a `using` declaration.
 *
 * From within a handler callback, the only method that may be called on the
 * parser is {@link stop}: the callback is invoked while libxml2 is parsing,
 * so re-entering the parser with {@link push} or {@link finish}, or freeing
 * it with {@link dispose}, throws an {@link XmlError}.
 *
 * @example
 * ```js
 * const decoder = new TextDecoder();
 * let title = '';
 * let inTitle = false;
 * using parser = XmlSaxParser.create({
 *     startElementNs(localName) { inTitle = localName === 'title'; },
 *     endElementNs() { inTitle = false; },
 *     characters(data) {
 *         if (inTitle) title += decoder.decode(data, { stream: true });
 *     },
 * });
 * for (const chunk of chunks) { // Uint8Array chunks, e.g. from a file stream
 *     parser.push(chunk);
 * }
 * parser.finish();
 * ```
 *
 * @see {@link XmlSaxHandler}
 * @alpha
 */
export declare class XmlSaxParser extends XmlDisposable<XmlSaxParser> {
    /** No more input is accepted: finish() or stop() was called,
     * or parsing failed. */
    private _terminated;
    /** Parsing was ended deliberately with stop(); implies terminated,
     * and makes the error code of the aborted parse call ignorable. */
    private _stopped;
    /** libxml2 is inside xmlParseChunk, so its frames are live and a handler
     * callback may be running; re-entering or freeing the parser now would
     * leave libxml2 parsing corrupted or freed state. */
    private parsing;
    /** The callback dispatch context. libxml2.mts holds it weakly, so that a
     * handler referring back to its own parser doesn't keep the parser alive;
     * this reference owns it, for as long as the parser is reachable. */
    private saxContext?;
    /**
     * Release the parser.
     *
     * @throws {@link XmlError} when called from within a handler callback,
     * where freeing the context would leave libxml2 parsing on freed memory;
     * dispose the parser after the {@link push} or {@link finish} call returns.
     */
    [Symbol.dispose](): void;
    /**
     * Create a push parser reporting to the given SAX handler.
     *
     * @param handler The callbacks receiving the parsing events
     * @param options Parsing options;
     * {@link ParseOptions#url} is used as the document URL in diagnostics and
     * {@link ParseOptions#option} is applied to the parser context.
     * Note: {@link ParseOption.XML_PARSE_HUGE} lifts libxml2's 10MB limit on a
     * single construct that has to be buffered before it can be reported,
     * such as a CDATA section.
     * Plain character data is streamed incrementally and is not subject to
     * this limit.
     * The options documented as not supported by the push parser cannot be
     * relied on: {@link ParseOption.XML_PARSE_NOBLANKS} has no effect, and
     * {@link ParseOption.XML_PARSE_RECOVER} only lets the events of the chunk
     * being pushed run to its end before the call throws all the same.
     * @throws {@link XmlError} when a document encoding is passed - the push
     * parser detects the encoding from the document itself - or when
     * {@link ParseOption.XML_PARSE_DTDVALID} is requested: libxml2 validates
     * against the tree that this parser deliberately doesn't build, so the
     * option would silently accept invalid documents.
     * @throws {@link XmlError} when {@link ParseOptions#option} contains bits
     * that this build of libxml2 doesn't support, which it would otherwise
     * silently ignore.
     */
    static create(handler: XmlSaxHandler, options?: ParseOptions): XmlSaxParser;
    /**
     * No more input is accepted: {@link finish} or {@link stop} was called,
     * parsing failed, or the parser was disposed.
     *
     * Test it to leave a feeding loop that a callback ended with {@link stop}.
     */
    get terminated(): boolean;
    /**
     * Non-fatal diagnostics (warning-level, {@link ErrorDetail#level} === 1)
     * emitted by libxml2 so far.
     * Fatal diagnostics are thrown by {@link push} or {@link finish}
     * as {@link XmlParseError}.
     *
     * @throws {@link XmlError} when the parser is disposed;
     * the diagnostics are released with it, so read them before.
     */
    get warnings(): ErrorDetail[];
    /**
     * Fatal diagnostics (error-level, {@link ErrorDetail#level} >= 2)
     * emitted by libxml2 so far.
     * {@link push} and {@link finish} already throw these as
     * {@link XmlParseError}; this getter exists for a parser ended early
     * with {@link stop}, which discards the ability to see them any other
     * way since {@link finish} - the only method that checks for them - can
     * no longer be called.
     *
     * @throws {@link XmlError} when the parser is disposed;
     * the diagnostics are released with it, so read them before.
     */
    get errors(): ErrorDetail[];
    /**
     * Feed a chunk of the document to the parser.
     *
     * The handler callbacks are invoked, synchronously,
     * for everything that can be parsed with the data available so far.
     * Call {@link finish} after the last chunk.
     *
     * @param chunk The next raw bytes of the document, as a `Uint8Array`
     * (a Node.js `Buffer` is one and is accepted as-is);
     * a decoded string is not accepted, the parser needs the bytes to detect
     * the encoding of the document
     * @throws {@link XmlParseError} when the chunk is malformed;
     * rethrows the exception if a handler callback throws one,
     * in which case parsing is aborted.
     * @throws {@link XmlError} when the chunk is not a `Uint8Array`.
     */
    push(chunk: Uint8Array): void;
    /**
     * Terminate parsing, processing any pending data.
     *
     * {@link XmlSaxHandler#endDocument} is invoked before this method returns,
     * for a truncated or otherwise malformed document as well as for a
     * complete one: it marks the end of the events, not a successful parse.
     * Only this method returning without throwing does.
     * The parser cannot be reused afterwards; it still has to be
     * {@link dispose}d.
     *
     * @throws {@link XmlParseError} when the document is incomplete or
     * otherwise malformed;
     * rethrows the exception if a handler callback throws one.
     */
    finish(): void;
    /**
     * Stop parsing before the end of the document, without raising an error.
     *
     * No further handler callback will be invoked.
     * May be called from within a handler callback;
     * the {@link push} call being processed then returns without error,
     * and any parse error pending from that aborted call is discarded.
     * Afterwards the parser accepts no more input and only needs to be
     * {@link dispose}d.
     * {@link finish} - the only method that raises {@link XmlParseError} for
     * error-level diagnostics - can then no longer be called; inspect
     * {@link errors} if the document may already have been malformed.
     *
     * Has no effect if parsing is already terminated.
     */
    stop(): void;
    private get details();
    private ensureAcceptingInput;
    private parseChunk;
    private throwParseError;
}
