import { Directive, Input } from '@angular/core';
import { RiveTransformComponent } from './transform-component';
import { Bone } from '@rive-app/canvas-advanced';


@Directive({
    selector: 'riv-bone, [rivBone]',
    exportAs: 'rivBone',
    standalone: true
})
export class RiveBone extends RiveTransformComponent<Bone> {
  @Input() set length(value: number | string | null | undefined) {
    this.set('length', value);
  }

  getComponent(name: string) {
    return this.canvas.artboard?.bone(name);
  }

}