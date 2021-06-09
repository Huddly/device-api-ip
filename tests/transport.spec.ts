import chai from 'chai';
import sinon from 'sinon';
import Logger from '@huddly/sdk/lib/src/utilitis/logger';
import HuddlyDevice from './../src/networkdevice';
import { HuddlyServiceClient } from '@huddly/huddlyproto/lib/proto/huddly_grpc_pb';
import * as grpc from '@grpc/grpc-js';
import GrpcTransport from './../src/transport';

const expect = chai.expect;
chai.should();
const dummyLogger = sinon.createStubInstance(Logger);

describe('GrpcTransport', () => {
    const aD1: HuddlyDevice = new HuddlyDevice({ mac: 'A1' });
    let transport: GrpcTransport;

    beforeEach(() => {
        transport = new GrpcTransport(aD1, dummyLogger);
    });

    describe('get #device', () => {
        it('should return device from constructor', () => {
            expect(transport.device).to.equal(aD1);
        });
    });
    describe('#grpcConnectionDeadlineSeconds', () => {
        describe('get', () => {
            it('should return default deadline', () => {
                expect(transport.grpcConnectionDeadlineSeconds).to.equal(1);
            });
        });
        describe('set', () => {
            it('should return whatever value we set', () => {
                transport.grpcConnectionDeadlineSeconds = 1000;
                expect(transport.grpcConnectionDeadlineSeconds).to.equal(1000);
            });
        });
    });

    describe('get #grpcClient', () => {
        let waitForReadyStub;
        afterEach(() => {
            waitForReadyStub.restore();
        });
        it('should return the initialized client when init is called', async () => {
            waitForReadyStub = sinon
                .stub(HuddlyServiceClient.prototype, 'waitForReady')
                .callsFake((deadline, cb) => {
                    cb(undefined);
                });
            await transport.init();
            expect(transport.grpcClient).to.not.equal(undefined);
        });
    });

    describe('#init', () => {
        let waitForReadyStub;
        afterEach(() => {
            waitForReadyStub.restore();
        });

        it('should connect', () => {
            waitForReadyStub = sinon
                .stub(HuddlyServiceClient.prototype, 'waitForReady')
                .callsFake((deadline, cb) => {
                    cb(undefined);
                });
            const p = transport.init();
            return expect(p).to.be.fulfilled;
        });
        it('should not connect', () => {
            waitForReadyStub = sinon
                .stub(HuddlyServiceClient.prototype, 'waitForReady')
                .callsFake((deadline, cb) => {
                    cb(Error('Something went wrong'));
                });
            const p = transport.init();
            return expect(p).to.eventually.be.rejectedWith('Something went wrong');
        });
    });

    describe('#overrideGrpcClient', () => {
        let waitForReadyStub;
        let closeSpy;
        afterEach(() => {
            waitForReadyStub.restore();
            closeSpy.restore();
        });
        it('should replace the existing grpcClient instance', async () => {
            waitForReadyStub = sinon
                .stub(HuddlyServiceClient.prototype, 'waitForReady')
                .callsFake((deadline, cb) => {
                    cb(undefined);
                });
            await transport.init();
            const oldClient: HuddlyServiceClient = transport.grpcClient;
            closeSpy = sinon.spy(oldClient, 'close');
            const newClient: HuddlyServiceClient = new HuddlyServiceClient(
                '1.2.3.4',
                grpc.credentials.createInsecure()
            );
            transport.overrideGrpcClient(newClient);
            expect(closeSpy.calledOnce).to.equals(true);
            expect(transport.grpcClient).to.deep.equal(newClient);
        });
    });

    describe('#close', () => {
        let waitForReadyStub;
        let closeSpy;
        afterEach(() => {
            waitForReadyStub.restore();
            closeSpy.restore();
        });
        it('should close grpc client if initialized', async () => {
            closeSpy = sinon.spy(HuddlyServiceClient.prototype, 'close');
            waitForReadyStub = sinon
                .stub(HuddlyServiceClient.prototype, 'waitForReady')
                .callsFake((deadline, cb) => {
                    cb(undefined);
                });
            await transport.init();
            await transport.close();
            expect(closeSpy.calledOnce).to.equals(true);
        });
        it('should not close when client is not initialized', async () => {
            closeSpy = sinon.spy(HuddlyServiceClient.prototype, 'close');
            await transport.close();
            expect(closeSpy.called).to.equals(false);
        });
    });
});
