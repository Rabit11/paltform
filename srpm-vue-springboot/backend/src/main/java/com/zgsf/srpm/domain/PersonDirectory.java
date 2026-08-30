package com.zgsf.srpm.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "person_directory")
public class PersonDirectory {
    @Id
    @Column(length = 32)
    private String empNo;
    @Column(nullable = false)
    private String name;
    private String unitCode;
    private String unitName;
    private String deptName;
    private boolean onJob = true;
    private Instant syncedAt;
}
