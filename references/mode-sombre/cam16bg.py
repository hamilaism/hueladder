# CAM16 (Li et al. 2017) forward model with variable background Yb, pure python.
import math
def oklch_to_lin(L,C,h):
    a=C*math.cos(math.radians(h)); b=C*math.sin(math.radians(h))
    l_=L+0.3963377774*a+0.2158037573*b; m_=L-0.1055613458*a-0.0638541728*b; s_=L-0.0894841775*a-1.2914855480*b
    l,m,s=l_**3,m_**3,s_**3
    return (4.0767416621*l-3.3077115913*m+0.2309699292*s,-1.2684380046*l+2.6097574011*m-0.3413193965*s,-0.0041960863*l-0.7034186147*m+1.7076147010*s)
def ingamut(rgb): return all(-1e-6<=c<=1+1e-6 for c in rgb)
def lin_to_xyz(r,g,b):
    return (100*(0.4124564*r+0.3575761*g+0.1804375*b),100*(0.2126729*r+0.7151522*g+0.0721750*b),100*(0.0193339*r+0.1191920*g+0.9503041*b))
M16=[[0.401288,0.650173,-0.051461],[-0.250268,1.204414,0.045854],[-0.002079,0.048952,0.953127]]
def mul(M,v): return [sum(M[i][j]*v[j] for j in range(3)) for i in range(3)]
W=lin_to_xyz(1,1,1)
def vc(Yb,La=64/math.pi*0.2*5,F=1.0,c=0.69,Nc=1.0):
    # La: adapting luminance cd/m2 (default ~ 20% of 200 cd/m2 display white -> ~40.7/ ... simplified)
    k=1/(5*La+1); FL=0.2*k**4*(5*La)+0.1*(1-k**4)**2*(5*La)**(1/3)
    n=Yb/W[1]; z=1.48+math.sqrt(n); Nbb=0.725*(1/n)**0.2
    D=F*(1-(1/3.6)*math.exp((-La-42)/92)); D=max(0,min(1,D))
    RGBw=mul(M16,W); Dr=[D*W[1]/x+1-D for x in RGBw]
    def adapt(x):
        p=(FL*abs(x)/100)**0.42; return math.copysign(400*p/(p+27.13),x)
    RGBaw=[adapt(Dr[i]*RGBw[i]) for i in range(3)]
    Aw=(2*RGBaw[0]+RGBaw[1]+0.05*RGBaw[2])*Nbb
    return dict(FL=FL,n=n,z=z,Nbb=Nbb,Dr=Dr,Aw=Aw,c=c,Nc=Nc,adapt=adapt)
def cam16(xyz,v):
    R=mul(M16,xyz); Ra=[v['adapt'](v['Dr'][i]*R[i]) for i in range(3)]
    a=Ra[0]-12*Ra[1]/11+Ra[2]/11; b=(Ra[0]+Ra[1]-2*Ra[2])/9
    h=math.degrees(math.atan2(b,a))%360
    et=0.25*(math.cos(math.radians(h)+2)+3.8)
    A=(2*Ra[0]+Ra[1]+0.05*Ra[2])*v['Nbb']
    J=100*(max(A,0)/v['Aw'])**(v['c']*v['z'])
    t=(50000/13*v['Nc']*v['Nbb']*et*math.hypot(a,b))/(Ra[0]+Ra[1]+21/20*Ra[2])
    C=t**0.9*math.sqrt(J/100)*(1.64-0.29**v['n'])**0.73
    Q=4/v['c']*math.sqrt(J/100)*(v['Aw']+4)*v['FL']**0.25
    M=C*v['FL']**0.25; s=100*math.sqrt(M/Q) if Q>0 else 0
    return dict(J=J,C=C,M=M,s=s,h=h,Q=Q)
def Yrel(L,C,h): return lin_to_xyz(*oklch_to_lin(L,C,h))[1]/100
def L_for_Y(Y,C,h):
    lo,hi=0,1
    for _ in range(60):
        mid=(lo+hi)/2
        if Yrel(mid,C,h)<Y: lo=mid
        else: hi=mid
    return (lo+hi)/2
def point(Y,C,h): L=L_for_Y(Y,C,h); return L,oklch_to_lin(L,C,h)
def maxC(Y,h):
    lo,hi=0,0.4
    for _ in range(40):
        mid=(lo+hi)/2
        if ingamut(point(Y,mid,h)[1]): lo=mid
        else: hi=mid
    return lo
def solveC(Y,h,v,key,target):
    lo,hi=0,maxC(Y,h)
    top=cam16(lin_to_xyz(*point(Y,hi,h)[1]),v)[key]
    if top<target: return None
    for _ in range(40):
        mid=(lo+hi)/2
        if cam16(lin_to_xyz(*point(Y,mid,h)[1]),v)[key]<target: lo=mid
        else: hi=mid
    return lo
if __name__=='__main__':
    Ybg_dark=((0x12/255+0.055)/1.055)**2.4  # #121212 relative luminance
    vW=vc(100); vD=vc(Ybg_dark*100); v20=vc(20)
    print(f"Yb white=100, dark #121212 Yb={Ybg_dark*100:.3f}")
    print("hue  CRlight  Ylight  Ydark | OKC_light  -> OKC_dark needed to keep CAM16 C / M / s  (under dark Yb)  | same with Yb=20 both (luminance effect only)")
    for h in [30,145,260,300]:
        for CR in [3.0,4.5,7.0]:
            Yl=1.05/CR-0.05; Yd=CR*(Ybg_dark+0.05)-0.05
            Cl=min(0.8*maxC(Yl,h),0.8*maxC(Yd,h))  # a chroma reachable at both luminances
            Pl=cam16(lin_to_xyz(*point(Yl,Cl,h)[1]),vW)
            res=[]
            for key in ['C','M','s']:
                x=solveC(Yd,h,vD,key,Pl[key]); res.append('out' if x is None else f"{x/Cl:.2f}")
            Pl20=cam16(lin_to_xyz(*point(Yl,Cl,h)[1]),v20)
            res20=[]
            for key in ['C','M','s']:
                x=solveC(Yd,h,v20,key,Pl20[key]); res20.append('out' if x is None else f"{x/Cl:.2f}")
            print(f"{h:3d}  {CR:4.1f}  {Yl:.3f}  {Yd:.3f} | {Cl:.3f} -> ratio C {res[0]}  M {res[1]}  s {res[2]} | Yb20: C {res20[0]} M {res20[1]} s {res20[2]}")
