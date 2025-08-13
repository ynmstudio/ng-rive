import { RiveCanvas as Rive } from '@rive-app/canvas-advanced';
import { Observable } from 'rxjs';

export const nextFrame = (rive: Rive): Promise<number> => {
  return new Promise((res) => {
    rive.requestAnimationFrame(res);
  });
};

// Observable that triggers on every frame rendered by Rive
export const animationFrame = (rive: Rive) =>
  new Observable<number>((subscriber) => {
    let start = 0;
    let first = true;
    const run = (time: number) => {
      const delta = time - start;
      start = time;
      if (first) {
        subscriber.next(16);
        first = false;
      } else {
        subscriber.next(delta);
      }
      if (subscriber.closed) return;
      rive.requestAnimationFrame(run);
    };
    rive.requestAnimationFrame(run);
  });
