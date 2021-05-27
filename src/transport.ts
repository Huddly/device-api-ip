import IGrpcTransport from '@huddly/sdk/lib/src/interfaces/IGrpcTransport';
import { EventEmitter } from 'events';
import * as grpc from '@grpc/grpc-js';
import { HuddlyServiceClient } from './proto/huddly_grpc_pb';
import HuddlyDevice from './networkdevice';
import Logger from '@huddly/sdk/lib/src/utilitis/logger';
import { Chunk, CnnFeature, CNNStatus, DeviceStatus, Feature, LogFile, LogFiles, Mode, PTZ } from './proto/huddly_pb';
import { TextDecoder } from 'util';
import { Empty } from 'google-protobuf/google/protobuf/empty_pb';

export default class GrpcTransport extends EventEmitter implements IGrpcTransport {
    logger: any;
    eventLoopSpeed: number;

    private _device: HuddlyDevice;
    private _grpcConnectionDeadlineSeconds: number = 1;
    private readonly GRPC_PORT: number = 50051;
    private _grpcClient: HuddlyServiceClient;

    constructor(device: HuddlyDevice, logger: any) {
        super();
        this._device = device;
        this.logger = logger || new Logger(true);
    }

    get device(): HuddlyDevice {
        return this._device;
    }

    get grpcConnectionDeadlineSeconds(): number {
        return this.grpcConnectionDeadlineSeconds;
    }

    set grpcConnectionDeadlineSeconds(seconds: number) {
        this._grpcConnectionDeadlineSeconds = seconds;
    }

    get grpcClient(): HuddlyServiceClient {
        return this._grpcClient;
    }

    init(): Promise<void> {
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + this._grpcConnectionDeadlineSeconds);
        this._grpcClient = new HuddlyServiceClient(`${this.device.ip}:${this.GRPC_PORT}`, grpc.credentials.createInsecure());
        return new Promise((resolve, reject) => {
            this.logger.debug(`Establishing grpc connection with device with deadline set to ${this._grpcConnectionDeadlineSeconds} seconds`, GrpcTransport.name);
            this._grpcClient.waitForReady(deadline, (error) => {
                if (error) {
                    this.logger.error(`Connection failed. Reason: ${error}`, GrpcTransport.name);
                    reject(error);
                } else {
                    this.logger.debug(`Connection established`, GrpcTransport.name);
                    resolve();
                }
            });
        });
    }

    close(): Promise<any> {
        if (this._grpcClient) {
            this._grpcClient.close();
        }
        return Promise.resolve();
    }

    getLogFiles(): Promise<String> {
        return new Promise((resolve, reject) => {
            const logFile = new LogFile();
            logFile.setFile(LogFiles.APP);
            logFile.setKeepLog(true);
            let data = '';

            const stream = this._grpcClient.getLogFiles(logFile);
            stream.on('data', (comment: Chunk) => {
                const string = new TextDecoder().decode(comment.getContent_asU8());
                data += string;
            });
            stream.on('end', () => resolve(data));
            stream.on('error', reject);
        });
    }

    getProductInfo(): Promise<any> {
        return new Promise((resolve, reject) => {
            const feature = new CnnFeature();
            feature.setFeature(Feature.AUTOZOOM);
            this._grpcClient.getCnnFeatureStatus(feature, (err: grpc.ServiceError, status: CNNStatus) => {
                if (err) {
                    reject();
                    return;
                }
                const m = status.getAzStatus();
                resolve({
                    autozoom_enabled: m.getAzEnabled(),
                });
            });
        });
    }

    getPTZ(): Promise<any> {
        return new Promise((res, rej) => {
            this.grpcClient.getPTZ(undefined, (err: grpc.ServiceError, ptz: PTZ) => {
                if (err || !ptz) {
                  rej();
                  return;
                }
                res({
                    pan: ptz.getPan(),
                    tilt: ptz.getTilt(),
                    zoom: ptz.getZoom(),
                });
            });
        });
    }

    setPTZ(pan: number, tilt: number, zoom: number): Promise<any> {
        return new Promise((res, rej) => {
            const cmd = new PTZ();
            cmd.setPan(pan);
            cmd.setTilt(tilt);
            cmd.setZoom(zoom);
            cmd.setTrans(0);
            this.grpcClient.setPTZ(cmd, async (err: grpc.ServiceError, status: DeviceStatus) => {
                if (err) {
                    rej();
                }
                res({});
            });
        });
    }

    getAutoZoomControl(): any {
        const feature = new CnnFeature();
        return {
            init: () => {},
            start: () => {
              return new Promise((res, rej) => {
                feature.setFeature(Feature.AUTOZOOM);
                feature.setMode(Mode.START);
                this.grpcClient.setCnnFeature(feature, (err, msg) => {
                  if (err) {
                    rej();
                  }
                  res(msg);
                });
              });
            },
            stop: () => {
              return new Promise((res, rej) => {
                feature.setFeature(Feature.AUTOZOOM);
                feature.setMode(Mode.STOP);
                this.grpcClient.setCnnFeature(feature, (err, msg) => {
                  if (err) {
                    rej();
                  }
                  res(msg);
                });
              });
            },
            enable: () => {
              return new Promise((res, rej) => {
                feature.setFeature(Feature.AUTOZOOM);
                feature.setMode(Mode.START);
                this.grpcClient.setCnnFeature(feature, (err, msg) => {
                  if (err) {
                    rej();
                  }
                  res(msg);
                });
              });
            },
            disable: () => {
              return new Promise((res, rej) => {
                feature.setFeature(Feature.AUTOZOOM);
                feature.setMode(Mode.START);
                this.grpcClient.setCnnFeature(feature, (err, msg) => {
                  if (err) {
                    rej();
                  }
                  res(msg);
                });
              });
            },
          };
    }
}
