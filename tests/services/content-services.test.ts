import {
  getMyIncidentReports,
  submitIncidentReport,
  uploadIncidentPhoto,
} from '@/services/firebase/incident.service';

// laws.service and news.service landed in Phase 6 — see laws.service.test.ts
// and news.service.test.ts for their behaviour tests.

describe('incident.service stubs', () => {
  it.each([
    ['getMyIncidentReports', () => getMyIncidentReports('user-1')],
    ['uploadIncidentPhoto', () => uploadIncidentPhoto('user-1', 'file:///img.jpg')],
    [
      'submitIncidentReport',
      () =>
        submitIncidentReport('user-1', {
          title: 'Followed',
          description: 'Followed near the station',
          latitude: 19.076,
          longitude: 72.8777,
          photoUrls: [],
        }),
    ],
  ])('%s rejects until Phase 7 lands', async (_name, call) => {
    await expect(call()).rejects.toThrow('Not implemented');
  });
});
