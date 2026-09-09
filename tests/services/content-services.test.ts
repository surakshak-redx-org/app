import {
  getMyIncidentReports,
  submitIncidentReport,
  uploadIncidentPhoto,
} from '@/services/firebase/incident.service';
import { getFaqs, getLawById, getLaws, getSafetyTips } from '@/services/firebase/laws.service';
import { getNews, getNewsById } from '@/services/firebase/news.service';
import {
  cancelSafeJourney,
  extendJourneyEta,
  markJourneyArrived,
  startSafeJourney,
} from '@/services/firebase/safe-journey.service';

describe('laws.service stubs', () => {
  it.each([
    ['getLaws', () => getLaws()],
    ['getLawById', () => getLawById('law-1')],
    ['getSafetyTips', () => getSafetyTips()],
    ['getFaqs', () => getFaqs()],
  ])('%s rejects until Phase 6 lands', async (_name, call) => {
    await expect(call()).rejects.toThrow('Not implemented');
  });
});

describe('news.service stubs', () => {
  it.each([
    ['getNews', () => getNews(10)],
    ['getNewsById', () => getNewsById('news-1')],
  ])('%s rejects until Phase 6 lands', async (_name, call) => {
    await expect(call()).rejects.toThrow('Not implemented');
  });
});

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

describe('safe-journey.service stubs', () => {
  it.each([
    ['startSafeJourney', () => startSafeJourney('user-1', 'Andheri', 19.1, 72.8, 30, ['user-2'])],
    ['markJourneyArrived', () => markJourneyArrived('session-1')],
    ['extendJourneyEta', () => extendJourneyEta('session-1', 15)],
    ['cancelSafeJourney', () => cancelSafeJourney('session-1')],
  ])('%s rejects until Phase 7 lands', async (_name, call) => {
    await expect(call()).rejects.toThrow('Not implemented');
  });
});
