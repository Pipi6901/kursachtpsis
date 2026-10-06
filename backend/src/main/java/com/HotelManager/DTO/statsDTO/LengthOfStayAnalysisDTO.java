package com.HotelManager.DTO.statsDTO;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class LengthOfStayAnalysisDTO {

    @JsonProperty("oneThree")
    private int OneThree;

    @JsonProperty("fourSix")
    private int FourSix;

    @JsonProperty("sevenNine")
    private int SevenNine;

    @JsonProperty("tenAndMore")
    private int TenAndMore;
}
