console.log('TEST: SessionManager loading started');

const { EventEmitter } = require('events');
console.log('TEST: EventEmitter imported');

class SessionManagerTest extends EventEmitter {
    constructor() {
        console.log('TEST: Constructor called');
        super();
        console.log('TEST: super() completed');
    }
    
    testMethod() {
        return 'working';
    }
}

console.log('TEST: Class defined, about to export');
module.exports = SessionManagerTest;
console.log('TEST: Export completed');
