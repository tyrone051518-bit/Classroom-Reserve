package AUTHmodels

type RequestBody struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

// Response of the Code can be change the value based on the need Response
// Take note the Struct Global named and the json must be the same, not a proble if it lower or upper case
// always use Json for Easy Integration in UI side/FrontEnd
type Response struct {
	Message     string `json:"message"`
	Token       string `json:"token,omitempty"`
	ID          int    `json:"id,omitempty"`
	Name        string `json:"name,omitempty"`
	AccountRole string `json:"account_role,omitempty"`
}
