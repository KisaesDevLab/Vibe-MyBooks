console.log('Vibe MyBooks Worker starting...');

// Worker processors will be registered here in Phase 9
console.log('Worker ready (no processors registered yet)');

// Keep the event loop alive. Without this, Node exits as soon as the two
// console.log calls finish, and Docker's `restart: unless-stopped` policy
// puts the container into a restart loop. Once Phase 9 registers real
// BullMQ workers they will hold the event loop open on their own and this
// no-op interval can be removed.
setInterval(() => {}, 1 << 30);
