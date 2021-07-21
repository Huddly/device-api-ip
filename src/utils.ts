import { networkInterfaces } from 'os';
import dgram from 'dgram';
import { v4 as uuidv4 } from 'node-uuid';
import et from 'elementtree';

export const makeDiscoveryBody = (msgId: String): Buffer => {
    const body =
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"' +
        'xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"' +
        'xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"' +
        'xmlns:tds="https://www.onvif.org/ver10/device/wsdl/devicemgmt.wsdl"' +
        'xmlns:dn="http://www.onvif.org/ver10/network/wsdl">' +
        '<e:Header>' +
        `<w:MessageID>${msgId}</w:MessageID>` +
        '<w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>' +
        '<w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>' +
        '</e:Header>' +
        '<e:Body>' +
        '<d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe>' +
        '</e:Body>' +
        '</e:Envelope>';
    return Buffer.from(body);
};

export const parseOnvifScopes = (
    scopes: String[],
    name: String,
    defaultValue: String[] = ['N/A']
): String[] => {
    const regex = `(?<=${name}/).*?(?=$|\\s)`;

    const foundValue = [];
    for (let i = 0; i < scopes.length; i++) {
        const element = scopes[i];
        const found = element.match(regex);
        if (found != undefined) {
            foundValue.push(found[0]);
        }
    }
    return foundValue.length > 0 ? foundValue : defaultValue;
};

export const manufacturerFromMac = (mac: String): String => {
    const HUDDLY_MAC_SERIES_START: Number = 0x90e2fc900000;
    const HUDDLY_MAC_SERIES_END: Number = 0x90e2fc9fffff;
    const HUDDLY_MANUFACTURER_NAME: String = 'Huddly';
    const numericMac = parseInt(mac.split(':').join(''), 16);
    return numericMac >= HUDDLY_MAC_SERIES_START && numericMac <= HUDDLY_MAC_SERIES_END
        ? HUDDLY_MANUFACTURER_NAME
        : '';
};

const containsHuddlyDevice = (ipV4Addr, cb) => {
    const socket = dgram.createSocket('udp4');
    socket.bind(() => socket.setMulticastInterface(ipV4Addr));
    console.log('Heeee');
    const messageHandler = msg => {
        const tree = et.parse(msg.toString());
        const matches = tree.findall('*/*/wsdd:ProbeMatch');
        matches.forEach(match => {
            const scopes = match
                .findtext('wsdd:Scopes')
                .toString()
                .split(' ');
            const macAddr = parseOnvifScopes(scopes, 'mac')[0];
            console.log(macAddr);
            if (manufacturerFromMac(macAddr)) {
                cb(ipV4Addr);
            }
        });
        socket.close();
    };

    socket.on('message', messageHandler);
    const body = makeDiscoveryBody('urn:uuid:' + uuidv4());
    socket.send(body, 0, body.length, 3702, '239.255.255.250');
};

export const getInterfaceWithHuddlyDevice = cb => {
    const nets = networkInterfaces();
    Object.values(nets).forEach(async net => {
        net.forEach(async dev => {
            if (dev.family === 'IPv4') {
                containsHuddlyDevice(dev.address, cb);
            }
        });
    });
};
