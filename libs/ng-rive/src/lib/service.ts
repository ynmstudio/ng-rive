import RiveBuilder from '@rive-app/canvas-advanced';
import { RiveCanvas as Rive } from '@rive-app/canvas-advanced';
import { Injectable, inject, Optional, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { animationFrame } from './frame';
import { share } from 'rxjs/operators';
import { RIVE_FOLDER, RIVE_VERSION, RIVE_WASM } from './tokens';
import { firstValueFrom, Observable } from 'rxjs';

@Injectable()
export class RiveService {
  private http = inject(HttpClient);
  private folder = inject(RIVE_FOLDER, { optional: true }) ?? 'assets/rive';
  private version = inject(RIVE_VERSION, { optional: true }) ?? '2.31.1';
  private wasmPath = inject(RIVE_WASM, { optional: true }) ??
    `https://unpkg.com/@rive-app/canvas-advanced@${this.version}/rive.wasm`;

  public rive?: Rive;
  public frame$?: Observable<number>;
  public frame?: Signal<number>;

  private async getRive() {
    if (!this.rive) {
      const locateFile = () => this.wasmPath;
      this.rive = await RiveBuilder({ locateFile });
      this.frame$ = animationFrame(this.rive).pipe(share());
      this.frame = toSignal(this.frame$, { initialValue: 0 });
    }
    return this.rive;
  }

  private getAsset(asset: string) {
    return firstValueFrom(this.http.get(asset, { responseType: 'arraybuffer' }));
  }

  /** Load a riv file */
  async load(file: string | File | Blob) {
    // Provide the file directly
    if (typeof file !== 'string') {
      const [ rive, buffer ] = await Promise.all([
        this.getRive(),
        file.arrayBuffer(),
      ]);
      return rive?.load(new Uint8Array(buffer));
    }

    const asset = `${this.folder}/${file}.riv`;
    const [ rive, buffer ] = await Promise.all([
      this.getRive(),
      this.getAsset(asset),
    ]);
    if (!rive) throw new Error('Could not load rive');
    return rive.load(new Uint8Array(buffer));
  }

}
