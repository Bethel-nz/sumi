import { Sumi } from '@bethel-nz/sumi';
import config from './sumi.config';

const sumi = new Sumi(config);

// Start the server
sumi.burn();
