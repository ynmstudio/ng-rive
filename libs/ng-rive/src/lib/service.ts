import RiveBuilder, { RiveCanvas as Rive, File as RiveFile } from '@rive-app/canvas-advanced';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, Optional, Signal, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { share } from 'rxjs/operators';
import { animationFrame } from './frame';
import { RIVE_FOLDER, RIVE_VERSION, RIVE_WASM } from './tokens';

@Injectable({ providedIn: 'root' })
export class RiveService {
  private http = inject(HttpClient);
  private folder = inject(RIVE_FOLDER, { optional: true }) ?? 'assets/rive';
  private version = inject(RIVE_VERSION, { optional: true }) ?? '2.1.0';
  private wasmPath =
    inject(RIVE_WASM, { optional: true }) ??
    `https://unpkg.com/@rive-app/canvas-advanced@${this.version}/rive.wasm`;

  private riveSignal = signal<Rive | null>(null);
  private frameSignal = signal<Observable<number> | null>(null);

  get rive(): Rive | null {
    return this.riveSignal();
  }

  get frame(): Observable<number> | null {
    return this.frameSignal();
  }

  private async getRive() {
    if (!this.riveSignal()) {
      const locateFile = () => this.wasmPath;
      const rive = await RiveBuilder({ locateFile });
      this.riveSignal.set(rive);
      this.frameSignal.set(animationFrame(rive).pipe(share()));
    }
    return this.riveSignal()!;
  }

  private getAsset(asset: string) {
    return firstValueFrom(
      this.http.get(asset, { responseType: 'arraybuffer' })
    );
  }

  /** Load a riv file */
  async load(file: string | File | Blob): Promise<RiveFile> {
    if (typeof file !== 'string') {
      const [rive, buffer] = await Promise.all([
        this.getRive(),
        file.arrayBuffer(),
      ]);
      return rive.load(new Uint8Array(buffer));
    }

    const asset = `${this.folder}/${file}.riv`;
    const [rive, buffer] = await Promise.all([
      this.getRive(),
      this.getAsset(asset),
    ]);
    return rive.load(new Uint8Array(buffer));
  }
}
