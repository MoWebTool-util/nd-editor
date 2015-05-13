'use strict';

var ua = navigator.userAgent;

var isIOS = /iP(?:ad|hone|od)/.test( ua );
var isMac = /Mac OS X/.test( ua );
var isGecko = /Gecko\//.test( ua );
var isIElt11 = /Trident\/[456]\./.test( ua );
var isPresto = !!window.opera;
var isWebKit = /WebKit\//.test( ua );

module.exports = {

  DOCUMENT_POSITION_PRECEDING: 2, // Node.DOCUMENT_POSITION_PRECEDING
  ELEMENT_NODE: 1,                // Node.ELEMENT_NODE;
  TEXT_NODE: 3,                   // Node.TEXT_NODE;
  SHOW_ELEMENT: 1,                // NodeFilter.SHOW_ELEMENT;
  SHOW_TEXT: 4,                   // NodeFilter.SHOW_TEXT;

  ZWS: '\u200B',

  START_SELECTION_ID: 'squire-selection-start',
  END_SELECTION_ID: 'squire-selection-end',

  TRANSPARENT_GIF: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',

  KEYS: {
    8: 'backspace',
    9: 'tab',
    13: 'enter',
    32: 'space',
    37: 'left',
    39: 'right',
    46: 'delete',
    219: '[',
    221: ']'
  },

  FONT_SIZES: {
    1: 10,
    2: 13,
    3: 16,
    4: 18,
    5: 24,
    6: 32,
    7: 48
  },

  INLINE_NODE_NAMES: /^(?:#text|A(?:BBR|CRONYM|UDIO)?|B(?:R|D[IO])?|C(?:ITE|ODE)|D(?:ATA|FN|EL)|EM|FONT|HR|I(?:NPUT|MG|NS)?|KBD|MARK|Q|R(?:P|T|UBY)|S(?:U[BP]|PAN|TR(?:IKE|ONG)|MALL|AMP)?|U|V(?:AR|IDEO)|WBR)$/,

  LEAF_NODE_NAMES: {
    BR: 1,
    IMG: 1,
    AUDIO: 1,
    VIDEO: 1,
    INPUT: 1,
    TEXTAREA: 1,
    BUTTON: 1,
    SELECT: 1
  },

  // ALLOWED_BLOCK: /^(?:A(?:DDRESS|RTICLE|SIDE|UDIO)|BLOCKQUOTE|CAPTION|D(?:[DLT]|IV)|F(?:IGURE|OOTER)|H[1-6]|HEADER|L(?:ABEL|EGEND|I)|O(?:L|UTPUT)|P(?:RE)?|SECTION|T(?:ABLE|BODY|D|FOOT|H|HEAD|R)|UL)$/,
  ALLOWED_BLOCK: /^(?:A(?:DDRESS|RTICLE|SIDE)|BLOCKQUOTE|CAPTION|D(?:[DLT]|IV)|F(?:IGURE|OOTER)|H[1-6]|HEADER|L(?:ABEL|EGEND|I)|O(?:L|UTPUT)|P(?:RE)?|SECTION|T(?:ABLE|BODY|D|FOOT|H|HEAD|R)|UL)$/,

  LINK_REGEXP: /\b((?:(?:ht|f)tps?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,}\/)(?:[^\s()<>]+|\([^\s()<>]+\))+(?:\((?:[^\s()<>]+|(?:\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))|([\w\-.%+]+@(?:[\w\-]+\.)+[A-Z]{2,}\b)/i,

  isIOS: isIOS,
  isMac: isMac,
  isGecko: isGecko,
  isIElt11: isIElt11,
  isPresto: isPresto,
  isWebKit: isWebKit,

  ctrlKey: isMac ? 'meta' : 'ctrl',

  useTextFixer: isIElt11 || isPresto,
  cantFocusEmptyTextNodes: isIElt11 || isWebKit,
  losesSelectionOnBlur: isIElt11,

  canObserveMutations: typeof MutationObserver !== 'undefined',

  // Use [^ \t\r\n] instead of \S so that nbsp does not count as white-space
  notWS: /[^ \t\r\n]/

};
