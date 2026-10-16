import test from 'node:test';
import assert from 'node:assert/strict';
import {native} from './native-harness.mjs';
const local=await import('../src/db/local.ts');
const {authenticatedOwner,savedSessionOwner}=await import('../src/auth/client.ts');
const offline={name:'AuthRetryableFetchError',message:'Failed to fetch'};
const key='auth:sb-synthetic-auth-token';

test('An expired session that cannot refresh offline is reported as offline, not signed out',async()=>{
 native.session=null;native.sessionError=offline;
 try{await assert.rejects(()=>authenticatedOwner(),/^Error: NETWORK$/);}
 finally{native.sessionError=null;}
 native.sessionError={name:'AuthApiError',message:'Invalid Refresh Token'};
 try{await assert.rejects(()=>authenticatedOwner(),/^Error: AUTH_REQUIRED$/);}
 finally{native.sessionError=null;}
 await assert.rejects(()=>authenticatedOwner(),/^Error: AUTH_REQUIRED$/);
});

test('The saved session owner is read without the network, and not after sign-out',async()=>{
 await local.purge();await local.write('auth_blocked',false);
 assert.equal(await savedSessionOwner(),null);
 await local.write(key,JSON.stringify({access_token:'a',refresh_token:'r',expires_at:1,user:{id:'auth-a'}}));
 assert.equal(await savedSessionOwner(),'auth-a');
 await local.write(key,'not json');
 assert.equal(await savedSessionOwner(),null);
 await local.write(key,JSON.stringify({access_token:'a',refresh_token:'r',expires_at:1,user:{id:'auth-a'}}));
 await local.purge();
 assert.equal(await savedSessionOwner(),null);
});
