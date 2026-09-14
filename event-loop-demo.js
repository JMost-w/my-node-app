console.log('5. Синхронный код');

setTimeout(() => {
    console.log('1. setTimeout');
}, 0);

setImmediate(() => {
    console.log('2. setImmediate');
});

process.nextTick(() => {
    console.log('3. process.nextTick');
});

Promise.resolve().then(() => {
    console.log('4. Promise.then');
});