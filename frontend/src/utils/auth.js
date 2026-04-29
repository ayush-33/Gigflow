// sessionStorage survives navigation but clears on tab close (safer than localStorage)
export const getAccessToken  = ()      => sessionStorage.getItem("accessToken");
export const setAccessToken  = (token) => {
  if (token) sessionStorage.setItem("accessToken", token);
  else sessionStorage.removeItem("accessToken");
};
export const clearAccessToken = ()     => sessionStorage.removeItem("accessToken");