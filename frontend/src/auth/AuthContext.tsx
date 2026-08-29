import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';
import { api } from '@/src/api/client';
import { Session } from '@/src/api/types';
interface AuthValue{session:Session|null;login(email:string,password:string):Promise<Session>;logout():void}
const AuthContext=createContext<AuthValue|undefined>(undefined);
export function AuthProvider({children}:PropsWithChildren){const[session,setSession]=useState<Session|null>(null);const value=useMemo<AuthValue>(()=>({session,async login(email,password){const s=await api.login(email,password);setSession(s);return s},logout(){setSession(null)}}),[session]);return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used within AuthProvider.');return value}
