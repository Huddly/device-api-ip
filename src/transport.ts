import IGrpcTransport from '@huddly/sdk/lib/src/interfaces/IGrpcTransport';
import { EventEmitter } from 'events';
import * as grpc from '@grpc/grpc-js';
import { HuddlyServiceClient } from '@huddly/camera-proto/lib/api/huddly_grpc_pb';
import HuddlyDevice from './networkdevice';
import Logger from '@huddly/sdk/lib/src/utilitis/logger';

export default class GrpcTransport extends EventEmitter implements IGrpcTransport {
    eventLoopSpeed: number;

    private _device: HuddlyDevice;
    private _grpcConnectionDeadlineSeconds: number = 2;
    private readonly GRPC_PORT: number = 50051;
    private _grpcClient: HuddlyServiceClient;

    constructor(device: HuddlyDevice) {
        super();
        this._device = device;
    }

    get device(): HuddlyDevice {
        return this._device;
    }

    get grpcConnectionDeadlineSeconds(): number {
        return this._grpcConnectionDeadlineSeconds;
    }

    set grpcConnectionDeadlineSeconds(value: number) {
        this._grpcConnectionDeadlineSeconds = value;
    }

    get grpcClient(): HuddlyServiceClient {
        return this._grpcClient;
    }

    init(): Promise<void> {
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + this._grpcConnectionDeadlineSeconds);
        this._grpcClient = new HuddlyServiceClient(
            `${this.device.ip}:${this.GRPC_PORT}`,
            grpc.credentials.createInsecure()
        );
        return new Promise((resolve, reject) => {
            Logger.debug(
                `Establishing grpc connection with device with deadline set to ${this._grpcConnectionDeadlineSeconds} seconds`,
                GrpcTransport.name
            );
            this._grpcClient.waitForReady(deadline, error => {
                if (error) {
                    Logger.error(
                        `Unable to establish grpc connection on address ${this.device.ip}:${this.GRPC_PORT}! ${error}`,
                        GrpcTransport.name
                    );
                    reject(error);
                } else {
                    Logger.debug(`Connection established`, GrpcTransport.name);
                    resolve();
                }
            });
        });
    }

    overrideGrpcClient(client: HuddlyServiceClient): void {
        // Close existing client
        if (this.grpcClient) {
            this.grpcClient.close();
        }
        // Override
        this._grpcClient = client;
    }

    close(): Promise<any> {
        if (this._grpcClient) {
            this._grpcClient.close();
        }
        return Promise.resolve();
    }
}
