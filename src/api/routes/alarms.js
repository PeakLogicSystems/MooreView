'use strict';



const { formatAckUserLabel } = require('../../tags/tagStore');



function createAlarmRoutes(deps) {

  const { tagStore } = deps;

  const mongoSysLog = require('../../logger/mongoSysLog');

  const { requireFeature } = require('../../auth/featureGate');

  const { isCloudDeployment } = require('../../cloud/agentProtocol');

  const router = require('express').Router();



  const ackGuard = isCloudDeployment()

    ? (req, res, next) => next()

    : requireFeature('alarms');



  function logUserFromRequest(req) {

    const user = req.mvAuth?.user;

    if (!user) return null;

    return {

      id: user.userId || user.id,

      email: user.email,

      name: user.name,

      role: user.role,

    };

  }



  function ackLogLabel(user) {

    return formatAckUserLabel(user) || 'unknown user';

  }



  router.post('/alarms/ack', ackGuard, (req, res) => {

    const body = req.body || {};

    const logUser = logUserFromRequest(req);



    if (body.all) {

      const count = tagStore.ackAllAlarms(logUser);

      mongoSysLog.info(

        'alarms',

        `Acknowledged ${count} active alarm(s) by ${ackLogLabel(logUser)}`,

        { count, ackedBy: logUser },

        { user: logUser },

      );

      return res.json({ ok: true, count, live: tagStore.liveSnapshotSlim() });

    }

    const tagId = String(body.tagId || '').trim();

    if (!tagId) {

      return res.status(400).json({ error: 'tagId required (or all: true)' });

    }

    if (!tagStore.get(tagId)) {

      return res.status(404).json({ error: 'tag not found' });

    }

    const ok = tagStore.ackAlarm(tagId, logUser);

    if (!ok) {

      return res.status(409).json({ error: 'tag has no active alarm' });

    }

    mongoSysLog.info(

      'alarms',

      `Alarm acknowledged (${tagId}) by ${ackLogLabel(logUser)}`,

      { tagId, ackedBy: logUser },

      { user: logUser },

    );

    return res.json({ ok: true, tagId, live: tagStore.liveSnapshotSlim() });

  });



  return router;

}



module.exports = { createAlarmRoutes };


