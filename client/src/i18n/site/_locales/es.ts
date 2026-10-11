// Generated aggregator — one file per namespace in ../<ns>/es.json. Edit the JSON, not this.
import common from '../common/es.json';
import home from '../home/es.json';
import features from '../features/es.json';
import business from '../business/es.json';
import partners from '../partners/es.json';
import safety from '../safety/es.json';
import company from '../company/es.json';
import legal from '../legal/es.json';
import account from '../account/es.json';
import mock from '../mock/es.json';

const messages: Record<string, string> = { ...common, ...home, ...features, ...business, ...partners, ...safety, ...company, ...legal, ...account, ...mock };
export default messages;
