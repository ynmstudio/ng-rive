import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RiveService } from './service';
import { RIVE_FOLDER } from './tokens';

const mockRive = {
  load: jest.fn(),
  requestAnimationFrame: jest.fn(),
  makeRenderer: jest.fn(),
};

jest.mock('@rive-app/canvas-advanced', () => ({
  __esModule: true,
  default: () => Promise.resolve(mockRive),
  RiveCanvas: class {},
  File: class {},
}));

describe('RiveService', () => {
  let service: RiveService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: RIVE_FOLDER, useValue: 'assets/rive' }],
    });
    service = TestBed.inject(RiveService);
    http = TestBed.inject(HttpTestingController);
  });

  it('loads riv file via http', async () => {
    const promise = service.load('test');
    const req = http.expectOne('assets/rive/test.riv');
    expect(req.request.method).toBe('GET');
    req.flush(new ArrayBuffer(8));
    await promise;
    expect(mockRive.load).toHaveBeenCalled();
  });
});
