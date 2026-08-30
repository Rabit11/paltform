package com.zgsf.srpm.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "projects")
public class ProjectEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true)
    private String code;
    @Column(nullable = false)
    private String name;
    private String level;
    private String status;
    private Long leadUnitId;
    private Double totalBudget;
}
