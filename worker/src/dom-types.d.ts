/**
 * DOM names the sim's browser-facing modules mention (render, audio, i18n, storage), so the
 * Worker's typecheck can follow Game's imports without the DOM lib - which cannot load here,
 * it collides with @cloudflare/workers-types. Declared as any, value and type both: the
 * Worker never executes a line that uses them, every use sits in a function the replay never
 * calls. If that ever changes the bundle fails loudly at runtime rather than typecheck a lie.
 */
declare const AudioBuffer: any;
declare type AudioBuffer = any;
declare const AudioBufferSourceNode: any;
declare type AudioBufferSourceNode = any;
declare const AudioContext: any;
declare type AudioContext = any;
declare const BiquadFilterNode: any;
declare type BiquadFilterNode = any;
declare const CanvasGradient: any;
declare type CanvasGradient = any;
declare const CanvasImageSource: any;
declare type CanvasImageSource = any;
declare const CanvasPattern: any;
declare type CanvasPattern = any;
declare const CanvasRenderingContext2D: any;
declare type CanvasRenderingContext2D = any;
declare const GainNode: any;
declare type GainNode = any;
declare const HTMLCanvasElement: any;
declare type HTMLCanvasElement = any;
declare const HTMLImageElement: any;
declare type HTMLImageElement = any;
declare const Image: any;
declare type Image = any;
declare const MutationObserver: new (callback: (records: any[], observer: any) => void) => any;
declare type MutationObserver = any;
declare const Node: any;
declare type Node = any;
declare const NodeFilter: any;
declare type NodeFilter = any;
declare const OscillatorNode: any;
declare type OscillatorNode = any;
declare const document: any;
declare type document = any;
declare const localStorage: any;
declare type localStorage = any;
declare const window: any;
declare type window = any;
interface ImportMeta { env: Record<string, string | undefined> }
interface Text { data: string }
