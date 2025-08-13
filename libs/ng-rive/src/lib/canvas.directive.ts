import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';
import { filter, switchMap } from 'rxjs/operators';
import {
  Artboard,
  CanvasRenderer,
  RiveCanvas as Rive,
  File as RiveFile,
  AABB,
  StateMachineInstance,
  LinearAnimationInstance,
} from '@rive-app/canvas-advanced';
import { RiveService } from './service';
import { getClientCoordinates, toInt } from './utils';

export type CanvasFit =
  | 'cover'
  | 'contain'
  | 'fill'
  | 'fitWidth'
  | 'fitHeight'
  | 'none'
  | 'scaleDown';
export type CanvasAlignment =
  | 'center'
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'centerLeft'
  | 'centerRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';

export type RiveOrigin = string | File | Blob | null;

const exist = <T>(v?: T | null): v is T => v !== null && v !== undefined;

const onVisible = (element: HTMLElement) =>
  new Promise<boolean>((res) => {
    if (typeof window === 'undefined') {
      return res(false);
    }
    if (!('IntersectionObserver' in window)) {
      return res(true);
    }
    let isVisible = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const visible = entry.intersectionRatio !== 0;
        if (visible !== isVisible) {
          res(visible);
          observer.disconnect();
        }
      });
    }, { threshold: [0] });
    observer.observe(element);
  });

@Directive({
  selector: 'canvas[riv]',
  exportAs: 'rivCanvas',
  standalone: true,
})
export class RiveCanvasDirective implements OnInit, OnDestroy {
  private service = inject(RiveService);
  private zone = inject(NgZone);
  private element = inject(ElementRef<HTMLCanvasElement>);

  private url = signal<RiveOrigin>(null);
  private artboardName = signal<string | null>(null);
  private file = signal<RiveFile | null>(null);
  private artboardSig = signal<Artboard | null>(null);
  private loaded = signal(false);

  private _ctx?: CanvasRenderingContext2D | null;
  private boxes: Record<string, AABB> = {};
  public canvas: HTMLCanvasElement = this.element.nativeElement;
  public rive?: Rive;
  public renderer?: CanvasRenderer;
  public stateMachines: Record<string, StateMachineInstance> = {};

  public whenVisible: Promise<boolean> = onVisible(this.canvas);

  @Input() set riv(url: RiveOrigin) {
    this.url.set(url);
  }

  @Input('artboard') set name(name: string) {
    this.artboardName.set(name);
  }

  @Input() viewbox = '0 0 100% 100%';
  @Input() lazy: boolean | '' = false;
  @Input() fit: CanvasFit = 'contain';
  @Input() alignment: CanvasAlignment = 'center';

  @Input()
  set width(w: number | string) {
    const width = toInt(w) ?? this.canvas.width;
    this.canvas.width = width;
  }
  get width() {
    return this.canvas.width;
  }

  @Input()
  set height(h: number | string) {
    const height = toInt(h) ?? this.canvas.height;
    this.canvas.height = height;
  }
  get height() {
    return this.canvas.height;
  }

  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() artboardChange = new EventEmitter<Artboard>();

  @HostListener('touchmove', ['$event'])
  @HostListener('mouseover', ['$event'])
  @HostListener('mouseout', ['$event'])
  @HostListener('mousemove', ['$event'])
  private pointerMove(event: MouseEvent | TouchEvent) {
    const stateMachines = Object.values(this.stateMachines).filter((sm) =>
      'pointerMove' in sm
    );
    if (!stateMachines.length) return;
    const vector = this.getTransform(event);
    if (!vector) return;
    for (const stateMachine of stateMachines) {
      stateMachine.pointerMove(vector.x, vector.y);
    }
  }

  @HostListener('touchstart', ['$event'])
  @HostListener('mousedown', ['$event'])
  private pointerDown(event: MouseEvent | TouchEvent) {
    const stateMachines = Object.values(this.stateMachines).filter((sm) =>
      'pointerDown' in sm
    );
    if (!stateMachines.length) return;
    const vector = this.getTransform(event);
    if (!vector) return;
    for (const stateMachine of stateMachines) {
      stateMachine.pointerDown(vector.x, vector.y);
    }
  }

  @HostListener('touchend', ['$event'])
  @HostListener('mouseup', ['$event'])
  private pointerUp(event: MouseEvent | TouchEvent) {
    const stateMachines = Object.values(this.stateMachines).filter((sm) =>
      'pointerUp' in sm
    );
    if (!stateMachines.length) return;
    const vector = this.getTransform(event);
    if (!vector) return;
    for (const stateMachine of stateMachines) {
      stateMachine.pointerUp(vector.x, vector.y);
    }
  }

  constructor() {
    effect(() => {
      const url = this.url();
      if (!exist(url)) return;
      this.zone.runOutsideAngular(async () => {
        const file = await this.service.load(url);
        this.rive = this.service.rive!;
        this.renderer = this.rive.makeRenderer(this.canvas) as CanvasRenderer;
        this.file.set(file);
      });
    });

    effect(() => {
      const file = this.file();
      const name = this.artboardName();
      if (!file) return;
      const artboard = name ? file.artboardByName(name) : file.defaultArtboard();
      this.artboardSig.set(artboard);
      this.artboardChange.emit(artboard);
      this.loaded.set(true);
    });
  }

  ngOnInit() {
    this.onReady();
  }

  ngOnDestroy() {
    setTimeout(() => {
      this.renderer?.delete();
      this.artboard?.delete();
      this.file()?.delete();
    }, 100);
  }

  get artboard(): Artboard | null {
    return this.artboardSig();
  }

  get ctx(): CanvasRenderingContext2D {
    if (!this._ctx) {
      this._ctx = this.canvas.getContext('2d');
    }
    return this._ctx as CanvasRenderingContext2D;
  }

  private setArtboard() {
    const file = this.file();
    if (!file) return;
    const name = this.artboardName();
    const artboard = name ? file.artboardByName(name) : file.defaultArtboard();
    this.artboardSig.set(artboard);
    this.artboardChange.emit(artboard);
  }

  get box() {
    const w = this.width as number;
    const h = this.height as number;
    const boxId = `${this.viewbox} ${w} ${h}`;
    if (!this.boxes[boxId]) {
      const bounds = this.viewbox.split(' ');
      if (bounds.length !== 4)
        throw new Error('View box should look like "0 0 100% 100%"');
      const [minX, minY, maxX, maxY] = bounds.map((v, i) => {
        const size: number = i % 2 === 0 ? w : h;
        const percentage = v.endsWith('%')
          ? parseInt(v.slice(0, -1), 10) / 100
          : parseInt(v, 10) / size;
        return i < 2 ? -size * percentage : size / percentage;
      });
      this.boxes[boxId] = { minX, minY, maxX, maxY } as AABB;
    }
    return this.boxes[boxId];
  }

  get isLazy() {
    return this.lazy === true || this.lazy === '';
  }

  get count() {
    return this.artboard?.animationCount();
  }

  onReady() {
    const loaded$ = toObservable(this.loaded);
    if (this.isLazy) {
      return from(this.whenVisible).pipe(
        filter((isVisible) => isVisible),
        switchMap(() => loaded$)
      );
    }
    return loaded$;
  }

  draw(instance: LinearAnimationInstance, delta: number, mix: number): void;
  draw(instance: StateMachineInstance, delta: number): void;
  draw(
    instance: StateMachineInstance | LinearAnimationInstance,
    delta: number,
    mix?: number
  ) {
    if (!this.rive) throw new Error('Could not load rive before registrating instance');
    if (!this.artboard) throw new Error('Could not load artboard before registrating instance');
    if (!this.renderer) throw new Error('Could not load renderer before registrating instance');

    this.renderer.clear();

    if (isLinearAnimation(instance)) {
      instance.advance(delta);
      instance.apply(mix ?? 1);
    } else {
      instance.advance(delta);
    }
    this.artboard.advance(delta);

    this.renderer.save();

    const fit = this.rive.Fit[this.fit];
    const alignment = this.rive.Alignment[this.alignment];
    const box = this.box;
    const bounds = this.artboard.bounds;
    this.renderer.align(fit, alignment, box, bounds);

    this.artboard.draw(this.renderer);

    this.renderer.restore();
  }

  private getTransform(event: MouseEvent | TouchEvent) {
    if (!this.rive) return;
    if (!this.artboard) return;
    const boundingRect = this.canvas.getBoundingClientRect();

    const { clientX, clientY } = getClientCoordinates(event);
    if (!clientX && !clientY) return;
    const canvasX = clientX - boundingRect.left;
    const canvasY = clientY - boundingRect.top;
    const forwardMatrix = this.rive.computeAlignment(
      this.rive.Fit[this.fit],
      this.rive.Alignment[this.alignment],
      {
        minX: 0,
        minY: 0,
        maxX: boundingRect.width,
        maxY: boundingRect.height,
      },
      this.artboard.bounds
    );
    const invertedMatrix = new this.rive.Mat2D();
    forwardMatrix.invert(invertedMatrix);
    const canvasCoordinatesVector = new this.rive.Vec2D(canvasX, canvasY);
    const transformedVector = this.rive.mapXY(
      invertedMatrix,
      canvasCoordinatesVector
    );
    const x = transformedVector.x();
    const y = transformedVector.y();

    transformedVector.delete();
    invertedMatrix.delete();
    canvasCoordinatesVector.delete();
    forwardMatrix.delete();
    return { x, y };
  }
}

function isLinearAnimation(
  instance: StateMachineInstance | LinearAnimationInstance
): instance is LinearAnimationInstance {
  return 'didLoop' in instance;
}
