export type Role = 'job_seeker' | 'counsellor' | 'platform_owner';
export type Modality = 'online' | 'in_person';
export interface User {id:string;name:string;email:string;role:Role}
export interface Session {accessToken:string;expiresAt:string;user:User}
export interface CounsellorSummary {id:string;displayName:string;introduction?:string;verificationStatus:'pending'|'verified'|'rejected';overallRating:number|null;reviewCount:number}
export interface Service {id:string;counsellor:CounsellorSummary;title:string;description:string;priceMinor:number;currency:'AUD';modalities:Modality[];location?:{state:string;cityOrRegion:string};active:boolean;averageRating:number|null;reviewCount:number}
export interface ApiErrorBody {code:string;message:string;fieldErrors?:Record<string,string>;requestId:string}
export interface RegisterRequest {name:string;email:string;password:string;passwordConfirmation:string;role:'job_seeker'|'counsellor'}
