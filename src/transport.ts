import ITransport from '@huddly/sdk/lib/src/interfaces/iTransport';
import { EventEmitter } from 'events';
import * as grpc from '@grpc/grpc-js';
import { HuddlyServiceClient } from './proto/huddly_grpc_pb';
import * as huddly from './proto/huddly_pb';
import HuddlyDevice from './networkdevice';
import { Empty } from 'google-protobuf/google/protobuf/empty_pb';
import Logger from '@huddly/sdk/lib/src/utilitis/logger';

export default class GrpcTransport extends EventEmitter implements ITransport {
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

    setEventLoopReadSpeed(timeout?: number): void {
        throw new Error('Method not supported');
    }

    initEventLoop(): void {
        throw new Error('Method not supported');
    }

    startListen(): Promise<void> {
        throw new Error('Method not supported');
    }

    receiveMessage(message: string, timeout?: number): Promise<any> {
        throw new Error('Method not supported');
    }

    read(receiveMsg?: string, timeout?: number): Promise<any> {
        throw new Error('Method not supported');
    }

    write(cmd: string, payload?: Buffer): Promise<any> {
        throw new Error('Method not supported');
    }

    subscribe(command: string): Promise<any> {
        throw new Error('Method not supported');
    }

    unsubscribe(command: string): Promise<any> {
        throw new Error('Method not supported');
    }

    clear(): Promise<any> {
        throw new Error('Method not supported');
    }


    stopEventLoop(): Promise<void> {
        throw new Error('Method not supported');
    }
}
