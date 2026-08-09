import moduleLoader from './libxml2raw.mjs';
import { ContextStorage } from './utils.mjs';
const libxml2 = await moduleLoader();
/* c8 ignore next 2, the branch will be hit only on Windows */
if (typeof process !== 'undefined' && process.platform === 'win32') {
    libxml2._xmlSetWinPathEnabled(1);
}
else {
    libxml2._xmlSetWinPathEnabled(0);
}
libxml2._xmlInitParser();
/**
 * Export runtime functions needed by other modules.
 * @internal
 */
export const { addFunction } = libxml2;
/**
 * The base class for exceptions in this library.
 *
 * All exceptions thrown in this library will be instances of this class or its subclasses.
 */
export class XmlError extends Error {
}
/**
 * libxml2 xmlErrorLevel: diagnostics at this severity or above are failures.
 * @internal
 */
export const XML_ERR_ERROR = 2;
/**
 * An exception class represents the error in libxml2.
 */
export class XmlLibError extends XmlError {
    constructor(message, details) {
        super(message);
        this.details = details;
    }
}
function allocUTF8Buffer(str) {
    if (!str) {
        return [0, 0];
    }
    const len = libxml2.lengthBytesUTF8(str);
    const buf = libxml2._malloc(len + 1);
    libxml2.stringToUTF8(str, buf, len + 1);
    return [buf, len];
}
function withStrings(process, ...strings) {
    const args = strings.map((str) => {
        const [buf] = allocUTF8Buffer(str);
        return buf;
    });
    const ret = process(...args);
    args.forEach((buf) => {
        if (buf) {
            libxml2._free(buf);
        }
    });
    return ret;
}
function withStringUTF8(str, process) {
    const [buf, len] = allocUTF8Buffer(str);
    const ret = process(buf, len);
    if (buf) {
        libxml2._free(buf);
    }
    return ret;
}
function moveUtf8ToString(cstr) {
    const str = libxml2.UTF8ToString(cstr);
    libxml2._free(cstr);
    return str;
}
function withCString(str, process) {
    if (!str) {
        return process(0, 0);
    }
    const buf = libxml2._malloc(str.length + 1);
    // _malloc returns 0 instead of aborting when the memory cannot grow
    // anymore; writing there would silently corrupt the module's low memory
    /* c8 ignore next 3, needs ~2GB of allocations to trigger */
    if (!buf) {
        throw new XmlError(`Failed to allocate ${str.length + 1} bytes in the WebAssembly memory`);
    }
    libxml2.HEAPU8.set(str, buf);
    libxml2.HEAPU8[buf + str.length] = 0;
    const ret = process(buf, str.length);
    libxml2._free(buf);
    return ret;
}
export function xmlReadString(ctxt, xmlString, url, encoding, options) {
    return withStringUTF8(xmlString, (xmlBuf, len) => withStrings((urlBuf, enc) => libxml2._xmlCtxtReadMemory(ctxt, xmlBuf, len, urlBuf, enc, options), url, encoding));
}
export function xmlReadMemory(ctxt, xmlBuffer, url, encoding, options) {
    return withCString(xmlBuffer, (xmlBuf, len) => withStrings((urlBuf, enc) => libxml2._xmlCtxtReadMemory(ctxt, xmlBuf, len, urlBuf, enc, options), url, encoding));
}
export function xmlXPathRegisterNs(ctx, prefix, uri) {
    return withStrings((bufPrefix, bufUri) => libxml2._xmlXPathRegisterNs(ctx, bufPrefix, bufUri), prefix, uri);
}
export function xmlHasNsProp(node, name, namespace) {
    return withStrings((bufName, bufNamespace) => libxml2._xmlHasNsProp(node, bufName, bufNamespace), name, namespace);
}
export function xmlSetNsProp(node, namespace, name, value) {
    return withStrings((bufName, bufValue) => libxml2._xmlSetNsProp(node, namespace, bufName, bufValue), name, value);
}
export function xmlNodeGetContent(node) {
    return moveUtf8ToString(libxml2._xmlNodeGetContent(node));
}
export function xmlNodeSetContent(node, content) {
    return withStringUTF8(content, (buf, len) => libxml2._xmlNodeSetContentLen(node, buf, len));
}
function getValueFunc(offset, type) {
    return (ptr) => {
        if (ptr === 0) {
            throw new XmlError('Access with null pointer');
        }
        return libxml2.getValue(ptr + offset, type);
    };
}
function nullableUTF8ToString(str) {
    if (str === 0) {
        return null;
    }
    return libxml2.UTF8ToString(str);
}
function getNullableStringValueFunc(offset) {
    return (ptr) => nullableUTF8ToString(libxml2.getValue(ptr + offset, 'i8*'));
}
function getStringValueFunc(offset) {
    return (ptr) => {
        if (ptr === 0) {
            throw new XmlError('Access with null pointer');
        }
        return libxml2.UTF8ToString(libxml2.getValue(ptr + offset, 'i8*'));
    };
}
export function xmlGetNsList(doc, node) {
    const nsList = libxml2._xmlGetNsList(doc, node);
    if (nsList === 0) {
        return [];
    }
    const arr = [];
    for (let offset = nsList / libxml2.HEAP32.BYTES_PER_ELEMENT; libxml2.HEAP32[offset]; offset += 1) {
        arr.push(libxml2.HEAP32[offset]);
    }
    libxml2._free(nsList);
    return arr;
}
export function xmlSearchNs(doc, node, prefix) {
    return withStrings((buf) => libxml2._xmlSearchNs(doc, node, buf), prefix);
}
export function xmlXPathCtxtCompile(ctxt, str) {
    return withStrings((buf) => libxml2._xmlXPathCtxtCompile(ctxt, buf), str);
}
export const error = {
    storage: new ContextStorage(),
    errorCollector: libxml2.addFunction((index, err) => {
        const file = XmlErrorStruct.file(err);
        const detail = {
            message: XmlErrorStruct.message(err),
            level: XmlErrorStruct.level(err),
            line: XmlErrorStruct.line(err),
            col: XmlErrorStruct.col(err),
        };
        if (file != null) {
            detail.file = file;
        }
        error.storage.get(index).push(detail);
    }, 'vii'),
};
export class XmlXPathObjectStruct {
}
XmlXPathObjectStruct.type = getValueFunc(0, 'i32');
XmlXPathObjectStruct.nodesetval = getValueFunc(4, '*');
XmlXPathObjectStruct.boolval = getValueFunc(8, 'i32');
XmlXPathObjectStruct.floatval = getValueFunc(16, 'double'); // 8 bytes padding
XmlXPathObjectStruct.stringval = getStringValueFunc(24);
XmlXPathObjectStruct.Type = {
    XPATH_NODESET: 1,
    XPATH_BOOLEAN: 2,
    XPATH_NUMBER: 3,
    XPATH_STRING: 4,
};
export class XmlNodeSetStruct {
    static nodeTable(nodeSetPtr, size) {
        // pointer to a pointer array, return the pointer array
        const tablePtr = libxml2.getValue(nodeSetPtr + 8, '*') / libxml2.HEAP32.BYTES_PER_ELEMENT;
        return libxml2.HEAP32.subarray(tablePtr, tablePtr + size);
    }
}
XmlNodeSetStruct.nodeCount = getValueFunc(0, 'i32');
export class XmlTreeCommonStruct {
}
XmlTreeCommonStruct.type = getValueFunc(4, 'i32');
XmlTreeCommonStruct.name_ = getStringValueFunc(8);
XmlTreeCommonStruct.children = getValueFunc(12, '*');
XmlTreeCommonStruct.last = getValueFunc(16, '*');
XmlTreeCommonStruct.parent = getValueFunc(20, '*');
XmlTreeCommonStruct.next = getValueFunc(24, '*');
XmlTreeCommonStruct.prev = getValueFunc(28, '*');
XmlTreeCommonStruct.doc = getValueFunc(32, '*');
export class XmlNamedNodeStruct extends XmlTreeCommonStruct {
}
XmlNamedNodeStruct.namespace = getValueFunc(36, '*');
export class XmlNodeStruct extends XmlNamedNodeStruct {
}
XmlNodeStruct.properties = getValueFunc(44, '*');
XmlNodeStruct.nsDef = getValueFunc(48, '*');
XmlNodeStruct.line = getValueFunc(56, 'i32');
export var XmlNodeType;
(function (XmlNodeType) {
    XmlNodeType[XmlNodeType["XML_ELEMENT_NODE"] = 1] = "XML_ELEMENT_NODE";
    XmlNodeType[XmlNodeType["XML_ATTRIBUTE_NODE"] = 2] = "XML_ATTRIBUTE_NODE";
    XmlNodeType[XmlNodeType["XML_TEXT_NODE"] = 3] = "XML_TEXT_NODE";
    XmlNodeType[XmlNodeType["XML_CDATA_SECTION_NODE"] = 4] = "XML_CDATA_SECTION_NODE";
    XmlNodeType[XmlNodeType["XML_ENTITY_REF_NODE"] = 5] = "XML_ENTITY_REF_NODE";
    XmlNodeType[XmlNodeType["XML_PI_NODE"] = 7] = "XML_PI_NODE";
    XmlNodeType[XmlNodeType["XML_COMMENT_NODE"] = 8] = "XML_COMMENT_NODE";
    XmlNodeType[XmlNodeType["XML_DOCUMENT_NODE"] = 9] = "XML_DOCUMENT_NODE";
    XmlNodeType[XmlNodeType["XML_DTD_NODE"] = 14] = "XML_DTD_NODE";
    XmlNodeType[XmlNodeType["XML_ELEMENT_DECL"] = 15] = "XML_ELEMENT_DECL";
    XmlNodeType[XmlNodeType["XML_ATTRIBUTE_DECL"] = 16] = "XML_ATTRIBUTE_DECL";
    XmlNodeType[XmlNodeType["XML_ENTITY_DECL"] = 17] = "XML_ENTITY_DECL";
    XmlNodeType[XmlNodeType["XML_NAMESPACE_DECL"] = 18] = "XML_NAMESPACE_DECL";
})(XmlNodeType || (XmlNodeType = {}));
export class XmlNsStruct {
}
XmlNsStruct.next = getValueFunc(0, '*');
XmlNsStruct.href = getStringValueFunc(8);
XmlNsStruct.prefix = getStringValueFunc(12);
export class XmlAttrStruct extends XmlTreeCommonStruct {
}
export class XmlErrorStruct {
}
XmlErrorStruct.message = getStringValueFunc(8);
XmlErrorStruct.level = getValueFunc(12, 'i32');
XmlErrorStruct.file = getNullableStringValueFunc(16);
XmlErrorStruct.line = getValueFunc(20, 'i32');
XmlErrorStruct.col = getValueFunc(40, 'i32');
export function xmlNewCDataBlock(doc, content) {
    return withStringUTF8(content, (buf, len) => libxml2._xmlNewCDataBlock(doc, buf, len));
}
export function xmlNewDocComment(doc, content) {
    return withStringUTF8(content, (buf) => libxml2._xmlNewDocComment(doc, buf));
}
export function xmlNewDocNode(doc, ns, name) {
    return withStrings((buf) => libxml2._xmlNewDocNode(doc, ns, buf, 0), name);
}
export function xmlNewDocText(doc, content) {
    return withStringUTF8(content, (buf, len) => libxml2._xmlNewDocTextLen(doc, buf, len));
}
export function xmlNewNs(node, href, prefix) {
    return withStrings((bufHref, bufPrefix) => libxml2._xmlNewNs(node, bufHref, bufPrefix), href, prefix ?? null);
}
export function xmlNewReference(doc, name) {
    return withStringUTF8(name, (buf) => libxml2._xmlNewReference(doc, buf));
}
/**
 * Register the callbacks from the provider to the system.
 *
 * @param provider Provider of callbacks to be registered.
 * @alpha
 */
export function xmlRegisterInputProvider(provider) {
    const matchFunc = libxml2.addFunction((cfilename) => {
        const filename = libxml2.UTF8ToString(cfilename);
        return provider.match(filename) ? 1 : 0;
    }, 'ii');
    const openFunc = libxml2.addFunction((cfilename) => {
        const filename = libxml2.UTF8ToString(cfilename);
        const res = provider.open(filename);
        return res ?? 0;
    }, 'ii');
    const readFunc = libxml2.addFunction((fd, cbuf, len) => provider.read(fd, libxml2.HEAPU8.subarray(cbuf, cbuf + len)), 'iiii');
    const closeFunc = libxml2.addFunction((fd) => (provider.close(fd) ? 0 : -1), 'ii');
    const res = libxml2._xmlRegisterInputCallbacks(matchFunc, openFunc, readFunc, closeFunc);
    return res >= 0;
}
/**
 * Remove and cleanup all registered input providers.
 * @alpha
 */
export function xmlCleanupInputProvider() {
    libxml2._xmlCleanupInputCallbacks();
}
// Live SAX parser contexts. libxml2 invokes the SAX callbacks with the parser
// context pointer as their first argument (the SAX user data is left NULL, so
// ctxt->userData falls back to the context itself), which keys this map.
// The references are weak: a handler usually refers back to its own parser -
// that is how stop() is called - so holding one here would root the parser in
// this module and keep it from ever being garbage collected.
const saxParsers = new Map();
// Shared skeleton of the SAX trampolines: look up the live dispatch context,
// suppress events after a failure, and never let a JS exception thrown by a
// handler callback unwind through the C frames of the parser - that would
// skip their cleanup - by stopping the parser and holding the exception
// until xmlParseChunk returns.
function saxCallback(sig, invoke) {
    return libxml2.addFunction((ctxt, ...args) => {
        const context = saxParsers.get(ctxt)?.deref();
        /* c8 ignore next 3, defensive: callbacks are suppressed after a failure */
        if (!context || context.failure) {
            return;
        }
        try {
            invoke(context, ...args);
        }
        catch (err) {
            context.failure = { error: err };
            libxml2._xmlStopParser(ctxt);
        }
    }, sig);
}
const saxStartDocument = saxCallback('vi', (context) => {
    context.handler.startDocument?.();
});
const saxEndDocument = saxCallback('vi', (context) => {
    context.handler.endDocument?.();
});
const saxStartElementNs = saxCallback('viiiiiiiii', (context, localName, prefix, uri, nbNamespaces, namespaces, nbAttributes, nbDefaulted, attributes) => {
    // the C callback stays installed when the JS one is removed mid-parse;
    // skip the marshalling below too, not just the invocation
    if (!context.handler.startElementNs) {
        return;
    }
    // pointers are 4-byte aligned and fit in HEAP32:
    // the memory is capped at 2GB (the ALLOW_MEMORY_GROWTH default)
    const ptrs = libxml2.HEAP32;
    // namespaces is an array of nbNamespaces (prefix, uri) pointer pairs
    const nsDecls = [];
    for (let slot = namespaces / 4, end = slot + nbNamespaces * 2; slot < end; slot += 2) {
        nsDecls.push([
            nullableUTF8ToString(ptrs[slot]),
            libxml2.UTF8ToString(ptrs[slot + 1]),
        ]);
    }
    // attributes is an array of nbAttributes
    // (localname, prefix, uri, value, end) pointer quintuplets;
    // the value is NOT null terminated, it spans [value, end)
    // DTD-defaulted attributes (counted in nbDefaulted) are appended after
    // the ones actually written in the document; drop them unless the
    // consumer asked for them, mirroring libxml2's own xmlSAX2StartElementNs
    const reportedAttributes = context.reportDtdDefaultedAttrs
        ? nbAttributes
        : nbAttributes - nbDefaulted;
    const attrs = [];
    for (let slot = attributes / 4, end = slot + reportedAttributes * 5; slot < end; slot += 5) {
        const value = ptrs[slot + 3];
        const valueEnd = ptrs[slot + 4];
        attrs.push({
            localName: libxml2.UTF8ToString(ptrs[slot]),
            prefix: nullableUTF8ToString(ptrs[slot + 1]),
            namespaceUri: nullableUTF8ToString(ptrs[slot + 2]),
            value: valueEnd > value ? libxml2.UTF8ToString(value, valueEnd - value) : '',
        });
    }
    context.handler.startElementNs(libxml2.UTF8ToString(localName), nullableUTF8ToString(prefix), nullableUTF8ToString(uri), nsDecls, attrs);
});
const saxEndElementNs = saxCallback('viiii', (context, localName, prefix, uri) => {
    context.handler.endElementNs?.(libxml2.UTF8ToString(localName), nullableUTF8ToString(prefix), nullableUTF8ToString(uri));
});
const saxCharacters = saxCallback('viii', (context, ch, len) => {
    context.handler.characters?.(libxml2.HEAPU8.subarray(ch, ch + len));
});
const saxCdataBlock = saxCallback('viii', (context, ch, len) => {
    context.handler.cdataBlock?.(libxml2.HEAPU8.subarray(ch, ch + len));
});
const saxComment = saxCallback('vii', (context, text) => {
    context.handler.comment?.(libxml2.UTF8ToString(text));
});
const saxProcessingInstruction = saxCallback('viii', (context, target, data) => {
    context.handler.processingInstruction?.(libxml2.UTF8ToString(target), nullableUTF8ToString(data));
});
/**
 * Field slots of struct xmlSAXHandler (each field is one 4-byte slot on wasm32).
 *
 * Pinned to the field order in the libxml2 submodule's include/libxml/parser.h:
 *
 *  0 internalSubset      1 isStandalone          2 hasInternalSubset
 *  3 hasExternalSubset   4 resolveEntity         5 getEntity
 *  6 entityDecl          7 notationDecl          8 attributeDecl
 *  9 elementDecl        10 unparsedEntityDecl   11 setDocumentLocator
 * 12 startDocument      13 endDocument          14 startElement
 * 15 endElement         16 reference            17 characters
 * 18 ignorableWhitespace 19 processingInstruction 20 comment
 * 21 warning            22 error                23 fatalError
 * 24 getParameterEntity 25 cdataBlock           26 externalSubset
 * 27 initialized        28 _private             29 startElementNs
 * 30 endElementNs       31 serror
 */
var SaxHandlerSlot;
(function (SaxHandlerSlot) {
    SaxHandlerSlot[SaxHandlerSlot["startDocument"] = 12] = "startDocument";
    SaxHandlerSlot[SaxHandlerSlot["endDocument"] = 13] = "endDocument";
    SaxHandlerSlot[SaxHandlerSlot["characters"] = 17] = "characters";
    SaxHandlerSlot[SaxHandlerSlot["ignorableWhitespace"] = 18] = "ignorableWhitespace";
    SaxHandlerSlot[SaxHandlerSlot["processingInstruction"] = 19] = "processingInstruction";
    SaxHandlerSlot[SaxHandlerSlot["comment"] = 20] = "comment";
    SaxHandlerSlot[SaxHandlerSlot["cdataBlock"] = 25] = "cdataBlock";
    SaxHandlerSlot[SaxHandlerSlot["initialized"] = 27] = "initialized";
    SaxHandlerSlot[SaxHandlerSlot["startElementNs"] = 29] = "startElementNs";
    SaxHandlerSlot[SaxHandlerSlot["endElementNs"] = 30] = "endElementNs";
})(SaxHandlerSlot || (SaxHandlerSlot = {}));
const SAX_HANDLER_SLOT_COUNT = 32;
// Magic value in the `initialized` field enabling the SAX2 interface;
// without it, xmlCreatePushParserCtxt copies only the SAX1-sized prefix
// of the struct and drops startElementNs/endElementNs.
const XML_SAX2_MAGIC = 0xDEEDBEAF;
/**
 * Create a libxml2 push parser context with SAX callbacks
 * dispatching to `handler`.
 *
 * Only the struct slots for callbacks present on `handler` are populated,
 * so skipped events never cross the WebAssembly boundary.
 *
 * @returns the parser context - 0 on failure - and the dispatch context that
 * the caller has to keep alive for as long as the parser is used.
 * @internal
 */
export function xmlCreatePushParserCtxt(handler, filename) {
    const context = { handler, reportDtdDefaultedAttrs: false };
    const sax = libxml2._malloc(SAX_HANDLER_SLOT_COUNT * 4);
    /* c8 ignore next 5, defensive: the allocation fails only when out of memory */
    if (!sax) {
        // a NULL handler would select libxml2's default, tree building one,
        // which reports nothing and defeats the purpose of the push parser
        return [0, context];
    }
    const base = sax / 4;
    const slots = libxml2.HEAP32;
    slots.fill(0, base, base + SAX_HANDLER_SLOT_COUNT);
    if (handler.startDocument) {
        slots[base + SaxHandlerSlot.startDocument] = saxStartDocument;
    }
    if (handler.endDocument) {
        slots[base + SaxHandlerSlot.endDocument] = saxEndDocument;
    }
    if (handler.startElementNs) {
        slots[base + SaxHandlerSlot.startElementNs] = saxStartElementNs;
    }
    if (handler.endElementNs) {
        slots[base + SaxHandlerSlot.endElementNs] = saxEndElementNs;
    }
    if (handler.characters) {
        slots[base + SaxHandlerSlot.characters] = saxCharacters;
        // Deliver whitespace-only character data through the same callback;
        // per the xmlSAXHandler docs, ignorableWhitespace should always be set
        // to the same value as characters, otherwise the parser tries to
        // detect "ignorable" whitespace, which is unreliable in push mode.
        slots[base + SaxHandlerSlot.ignorableWhitespace] = saxCharacters;
    }
    if (handler.cdataBlock) {
        slots[base + SaxHandlerSlot.cdataBlock] = saxCdataBlock;
    }
    if (handler.comment) {
        slots[base + SaxHandlerSlot.comment] = saxComment;
    }
    if (handler.processingInstruction) {
        slots[base + SaxHandlerSlot.processingInstruction] = saxProcessingInstruction;
    }
    slots[base + SaxHandlerSlot.initialized] = XML_SAX2_MAGIC;
    // user data is left NULL: ctxt->userData then defaults to the context
    // itself, which is what the shared callbacks above use as dispatch key
    const ctxt = withStringUTF8(filename, (buf) => libxml2._xmlCreatePushParserCtxt(sax, 0, 0, 0, buf));
    // the context copies the struct, it doesn't keep the pointer
    libxml2._free(sax);
    if (ctxt) {
        saxParsers.set(ctxt, new WeakRef(context));
    }
    return [ctxt, context];
}
/**
 * Parse a chunk of data with a push parser context.
 *
 * Rethrows the exception if a SAX callback of the chunk threw one.
 *
 * @returns the xmlParserErrors code of the parse, 0 on success.
 * @internal
 */
export function xmlParseChunk(ctxt, chunk, terminate) {
    const flag = terminate ? 1 : 0;
    let ret;
    if (chunk) {
        ret = withCString(chunk, (buf, len) => libxml2._xmlParseChunk(ctxt, buf, len, flag));
    }
    else {
        ret = libxml2._xmlParseChunk(ctxt, 0, 0, flag);
    }
    const parser = saxParsers.get(ctxt)?.deref();
    if (parser?.failure) {
        const { error: err } = parser.failure;
        delete parser.failure;
        throw err;
    }
    return ret;
}
/**
 * Free a push parser context created by {@link xmlCreatePushParserCtxt}
 * and its callback dispatch entry.
 * @internal
 */
export function xmlFreeSaxParserCtxt(ctxt) {
    saxParsers.delete(ctxt);
    // Even in SAX mode, libxml2 keeps the entities declared in the internal
    // subset in a document of its own, and releases it only when the parse
    // runs to its end - not when it is stopped, fails or is abandoned.
    // xmlFreeParserCtxt doesn't free it either; xmlCtxtGetDocument detaches
    // it from the context, either handing it over or freeing it itself
    // (after a fatal error).
    const doc = libxml2._xmlCtxtGetDocument(ctxt);
    if (doc) {
        libxml2._xmlFreeDoc(doc);
    }
    libxml2._xmlFreeParserCtxt(ctxt);
}
export function xmlSaveOption(options) {
    if (!options) {
        return 1; // default is to format with default setting
    }
    let flags = 0;
    if (options.format) {
        flags |= 1 << 0;
    }
    if (options.noDeclaration) {
        flags |= 1 << 1;
    }
    if (options.noEmptyTags) {
        flags |= 1 << 2;
    }
    return flags;
}
const outputHandlerStorage = new ContextStorage();
const outputWrite = libxml2.addFunction((index, buf, len) => outputHandlerStorage.get(index)
    .write(libxml2.HEAPU8.subarray(buf, buf + len)), 'iiii');
const outputClose = libxml2.addFunction((index) => {
    const ret = outputHandlerStorage.get(index).close();
    outputHandlerStorage.free(index);
    return ret;
}, 'ii');
export function xmlSaveToIO(handler, encoding, format) {
    const index = outputHandlerStorage.allocate(handler); // will be freed in outputClose
    return withStringUTF8(encoding, (encBuf) => libxml2._xmlSaveToIO(outputWrite, outputClose, index, encBuf, format));
}
var XmlParserInputFlags;
(function (XmlParserInputFlags) {
    XmlParserInputFlags[XmlParserInputFlags["XML_INPUT_BUF_STATIC"] = 2] = "XML_INPUT_BUF_STATIC";
    XmlParserInputFlags[XmlParserInputFlags["XML_INPUT_BUF_ZERO_TERMINATED"] = 4] = "XML_INPUT_BUF_ZERO_TERMINATED";
    XmlParserInputFlags[XmlParserInputFlags["XML_INPUT_UNZIP"] = 8] = "XML_INPUT_UNZIP";
    XmlParserInputFlags[XmlParserInputFlags["XML_INPUT_NETWORK"] = 16] = "XML_INPUT_NETWORK";
})(XmlParserInputFlags || (XmlParserInputFlags = {}));
export function xmlCtxtParseDtd(ctxt, mem, publicId, systemId) {
    return withCString(mem, (buf, len) => {
        const input = libxml2._xmlNewInputFromMemory(0, buf, len, XmlParserInputFlags.XML_INPUT_BUF_STATIC
            | XmlParserInputFlags.XML_INPUT_BUF_ZERO_TERMINATED);
        return withStrings((publicIdBuf, systemIdBuf) => libxml2._xmlCtxtParseDtd(ctxt, input, publicIdBuf, systemIdBuf), publicId, systemId);
    });
}
export function xmlSaveSetIndentString(ctxt, indent) {
    return withStringUTF8(indent, (buf) => libxml2._xmlSaveSetIndentString(ctxt, buf));
}
/**
 * Helper to create a C-style NULL-terminated array of C strings.
 *
 * Allocates a single contiguous memory block containing:
 * - First: the pointer array (n+1 pointers, last is NULL)
 * - Then: the string data (all strings with null terminators)
 *
 * Memory layout: [ptr0][ptr1]...[ptrN][NULL][str0\0][str1\0]...[strN\0]
 *
 * @returns The pointer to the allocated memory. Caller must free with {@link free}.
 */
export function allocCStringArray(strings) {
    // Calculate total size needed
    const pointerArraySize = (strings.length + 1) * 4; // +1 for NULL terminator
    const stringSizes = strings.map((s) => libxml2.lengthBytesUTF8(s) + 1);
    const totalStringSize = stringSizes.reduce((sum, size) => sum + size, 0);
    const totalSize = pointerArraySize + totalStringSize;
    // Allocate single block
    const ptr = libxml2._malloc(totalSize);
    // Write strings and set pointers
    let stringOffset = ptr + pointerArraySize;
    const ptrArrayBase = ptr / libxml2.HEAP32.BYTES_PER_ELEMENT;
    strings.forEach((s, i) => {
        // Set pointer to this string
        libxml2.HEAP32[ptrArrayBase + i] = stringOffset;
        // Write the string
        libxml2.stringToUTF8(s, stringOffset, stringSizes[i]);
        stringOffset += stringSizes[i];
    });
    // NULL terminate the pointer array
    libxml2.HEAP32[ptrArrayBase + strings.length] = 0;
    return ptr;
}
export const free = libxml2._free;
export const xmlAddChild = libxml2._xmlAddChild;
export const xmlAddNextSibling = libxml2._xmlAddNextSibling;
export const xmlAddPrevSibling = libxml2._xmlAddPrevSibling;
export const xmlCtxtSetErrorHandler = libxml2._xmlCtxtSetErrorHandler;
export const xmlCtxtSetOptions = libxml2._xmlCtxtSetOptions;
export const xmlCtxtValidateDtd = libxml2._xmlCtxtValidateDtd;
export const xmlDocGetRootElement = libxml2._xmlDocGetRootElement;
export const xmlDocSetRootElement = libxml2._xmlDocSetRootElement;
export const xmlFreeDoc = libxml2._xmlFreeDoc;
export const xmlFreeNode = libxml2._xmlFreeNode;
export const xmlFreeDtd = libxml2._xmlFreeDtd;
export const xmlFreeParserCtxt = libxml2._xmlFreeParserCtxt;
export const xmlGetIntSubset = libxml2._xmlGetIntSubset;
export const xmlGetLastError = libxml2._xmlGetLastError;
export const xmlNewDoc = libxml2._xmlNewDoc;
export const xmlNewParserCtxt = libxml2._xmlNewParserCtxt;
export const xmlRelaxNGFree = libxml2._xmlRelaxNGFree;
export const xmlRelaxNGFreeParserCtxt = libxml2._xmlRelaxNGFreeParserCtxt;
export const xmlRelaxNGFreeValidCtxt = libxml2._xmlRelaxNGFreeValidCtxt;
export const xmlRelaxNGNewDocParserCtxt = libxml2._xmlRelaxNGNewDocParserCtxt;
export const xmlRelaxNGNewValidCtxt = libxml2._xmlRelaxNGNewValidCtxt;
export const xmlRelaxNGParse = libxml2._xmlRelaxNGParse;
export const xmlRelaxNGSetParserStructuredErrors = libxml2._xmlRelaxNGSetParserStructuredErrors;
export const xmlRelaxNGSetValidStructuredErrors = libxml2._xmlRelaxNGSetValidStructuredErrors;
export const xmlRelaxNGValidateDoc = libxml2._xmlRelaxNGValidateDoc;
export const xmlRemoveProp = libxml2._xmlRemoveProp;
export const xmlResetLastError = libxml2._xmlResetLastError;
export const xmlSaveClose = libxml2._xmlSaveClose;
export const xmlSaveDoc = libxml2._xmlSaveDoc;
export const xmlSaveTree = libxml2._xmlSaveTree;
export const xmlSchemaFree = libxml2._xmlSchemaFree;
export const xmlSchemaFreeParserCtxt = libxml2._xmlSchemaFreeParserCtxt;
export const xmlSchemaFreeValidCtxt = libxml2._xmlSchemaFreeValidCtxt;
export const xmlSchemaNewDocParserCtxt = libxml2._xmlSchemaNewDocParserCtxt;
export const xmlSchemaNewValidCtxt = libxml2._xmlSchemaNewValidCtxt;
export const xmlSchemaParse = libxml2._xmlSchemaParse;
export const xmlSchemaSetParserStructuredErrors = libxml2._xmlSchemaSetParserStructuredErrors;
export const xmlSchemaSetValidStructuredErrors = libxml2._xmlSchemaSetValidStructuredErrors;
export const xmlSchemaValidateDoc = libxml2._xmlSchemaValidateDoc;
export const xmlSchemaValidateOneElement = libxml2._xmlSchemaValidateOneElement;
export const xmlSetNs = libxml2._xmlSetNs;
export const xmlStopParser = libxml2._xmlStopParser;
export const xmlUnlinkNode = libxml2._xmlUnlinkNode;
export const xmlXIncludeFreeContext = libxml2._xmlXIncludeFreeContext;
export const xmlXIncludeNewContext = libxml2._xmlXIncludeNewContext;
export const xmlXIncludeProcessNode = libxml2._xmlXIncludeProcessNode;
export const xmlXIncludeSetErrorHandler = libxml2._xmlXIncludeSetErrorHandler;
export const xmlXPathCompiledEval = libxml2._xmlXPathCompiledEval;
export const xmlXPathFreeCompExpr = libxml2._xmlXPathFreeCompExpr;
export const xmlXPathFreeContext = libxml2._xmlXPathFreeContext;
export const xmlXPathFreeObject = libxml2._xmlXPathFreeObject;
export const xmlXPathNewContext = libxml2._xmlXPathNewContext;
export const xmlXPathSetContextNode = libxml2._xmlXPathSetContextNode;
/**
 * Create an output buffer using I/O callbacks (same pattern as xmlSaveToIO)
 * @internal
 */
export function xmlOutputBufferCreateIO(handler) {
    const index = outputHandlerStorage.allocate(handler); // will be freed in outputClose
    return libxml2._xmlOutputBufferCreateIO(outputWrite, outputClose, index, 0);
}
export const xmlOutputBufferClose = libxml2._xmlOutputBufferClose;
export const xmlC14NExecute = libxml2._xmlC14NExecute;
//# sourceMappingURL=libxml2.mjs.map