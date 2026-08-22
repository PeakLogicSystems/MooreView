'use strict';

const MODBUS_FC = {
  1: 'ReadCoils',
  2: 'ReadDiscreteInputs',
  3: 'ReadHoldingRegisters',
  4: 'ReadInputRegisters',
  5: 'WriteSingleCoil',
  6: 'WriteSingleRegister',
  15: 'WriteMultipleCoils',
  16: 'WriteMultipleRegisters',
};

function decodeModbusTcp(buf) {
  if (!buf || buf.length < 8) return null;
  const transactionId = buf.readUInt16BE(0);
  const protocolId = buf.readUInt16BE(2);
  if (protocolId !== 0) return null;
  const length = buf.readUInt16BE(4);
  if (length < 2 || 6 + length > buf.length + 2) {
    /* length field includes unit id + pdu */
  }
  const unitId = buf[6];
  const fc = buf[7];
  const pdu = buf.subarray(8);

  const out = {
    protocol: 'modbus-tcp',
    transactionId,
    unitId,
    functionCode: fc,
    functionName: MODBUS_FC[fc] || `FC${fc}`,
  };

  if (fc === 3 || fc === 4) {
    if (pdu.length >= 5) {
      out.startAddress = pdu.readUInt16BE(1);
      out.quantity = pdu.readUInt16BE(3);
    }
  } else if (fc === 6 && pdu.length >= 5) {
    out.address = pdu.readUInt16BE(1);
    out.value = pdu.readUInt16BE(3);
  } else if ((fc === 3 || fc === 4) && pdu[0] === pdu.length - 1) {
    out.byteCount = pdu[0];
    out.registerData = pdu.subarray(1, 1 + pdu[0]).toString('hex');
  }

  if (pdu.length >= 1 && pdu[0] < 0x80) {
    /* request */
  } else if (fc >= 0x80) {
    out.exception = true;
    out.exceptionCode = pdu[1];
  }

  return out;
}

module.exports = { decodeModbusTcp };
